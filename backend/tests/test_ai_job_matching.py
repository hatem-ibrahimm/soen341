
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from src.main.ai_job_matching import (
    register_ai_job_matching_routes,
    redact_contact_information,
)
from src.main.ai_job_matching_service import (
    JobMatchingServiceError,
    JobMatchingResponseError,
)


PROFILE_ID = "11111111-1111-4111-8111-111111111111"
OTHER_PROFILE_ID = "22222222-2222-4222-8222-222222222222"

ENDPOINT = f"/api/profiles/{PROFILE_ID}/job-matches"

JOB_COLUMNS = [
    "id",
    "title",
    "company_name",
    "location",
    "category",
    "description",
    "required_skills",
]

JOB_ROW = (
    1,
    "Python Developer",
    "Test Company",
    "Montreal",
    "Technology",
    "Develop software using Python.",
    ["Python", "SQL"],
)

RECOMMENDATION = {
    "job_id": 1,
    "match_score": 90,
    "matching_skills": ["Python"],
    "missing_skills": ["SQL"],
    "explanation": "Relevant Python development experience.",
}


@pytest.fixture
def setup_api():
    app = Flask(__name__)
    app.config["TESTING"] = True

    connection = MagicMock()
    cursor = connection.cursor.return_value

    get_connection = MagicMock(
        return_value=connection
    )

    get_current_user = MagicMock(
        return_value=SimpleNamespace(id=PROFILE_ID)
    )

    get_resume_storage = MagicMock()

    register_ai_job_matching_routes(
        app,
        get_connection,
        get_current_user,
        get_resume_storage,
    )

    cursor.description = [
        (column,) for column in JOB_COLUMNS
    ]

    cursor.fetchone.side_effect = [
        ("Software Engineering Student", "Python developer"),
        ("resume.pdf", "resumes/resume.pdf"),
    ]

    cursor.fetchall.side_effect = [
        [("Python",), ("C++",)],
        [
            (
                "Developer Intern",
                "Test Company",
                "2026",
                "Developed Python applications.",
            )
        ],
        [
            (
                "Test University",
                "Software Engineering",
                "2024-2028",
            )
        ],
        [JOB_ROW],
    ]

    get_resume_storage.return_value.download.return_value = (
        b"fake resume bytes"
    )

    return SimpleNamespace(
        client=app.test_client(),
        connection=connection,
        cursor=cursor,
        get_connection=get_connection,
        get_current_user=get_current_user,
        get_resume_storage=get_resume_storage,
    )


def test_job_matching_success(setup_api):
    with patch(
        "src.main.ai_job_matching.extract_resume_text",
        return_value="Python development experience",
    ), patch(
        "src.main.ai_job_matching.generate_job_matches",
        return_value=[RECOMMENDATION],
    ) as mock_ai:

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 200

        data = response.get_json()

        assert len(data["recommendations"]) == 1
        assert data["resume_used"] is True
        assert data["jobs_analyzed"] == 1

        match = data["recommendations"][0]

        assert match["job_id"] == 1
        assert match["match_score"] == 90
        assert match["job"]["title"] == "Python Developer"

        mock_ai.assert_called_once()

        profile, resume_text, jobs = mock_ai.call_args.args

        assert "Python" in profile["skills"]
        assert len(profile["education"]) == 1
        assert len(profile["work_experience"]) == 1
        assert resume_text == "Python development experience"
        assert jobs[0]["id"] == 1

        setup_api.connection.close.assert_called_once()


def test_authentication_required(setup_api):
    setup_api.get_current_user.return_value = None

    response = setup_api.client.post(ENDPOINT)

    assert response.status_code == 401
    setup_api.get_connection.assert_not_called()


def test_invalid_profile_id(setup_api):
    response = setup_api.client.post(
        "/api/profiles/invalid-id/job-matches"
    )

    assert response.status_code == 400


def test_cannot_access_another_profile(setup_api):
    response = setup_api.client.post(
        f"/api/profiles/{OTHER_PROFILE_ID}/job-matches"
    )

    assert response.status_code == 403
    setup_api.get_connection.assert_not_called()


def test_profile_not_found(setup_api):
    setup_api.cursor.fetchone.side_effect = [None]

    response = setup_api.client.post(ENDPOINT)

    assert response.status_code == 404


def test_matching_without_resume(setup_api):
    setup_api.cursor.fetchone.side_effect = [
        ("Software Engineering Student", "Python developer"),
        None,
    ]

    with patch(
        "src.main.ai_job_matching.generate_job_matches",
        return_value=[RECOMMENDATION],
    ) as mock_ai:

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 200

        data = response.get_json()

        assert data["resume_used"] is False
        assert len(data["warnings"]) == 1

        assert mock_ai.call_args.args[1] == ""

        setup_api.get_resume_storage.assert_not_called()


def test_unreadable_resume_uses_profile(setup_api):
    with patch(
        "src.main.ai_job_matching.extract_resume_text",
        side_effect=ValueError("Unreadable resume"),
    ), patch(
        "src.main.ai_job_matching.generate_job_matches",
        return_value=[RECOMMENDATION],
    ):

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 200

        data = response.get_json()

        assert data["resume_used"] is False
        assert len(data["warnings"]) == 1


def test_no_available_jobs(setup_api):
    setup_api.cursor.fetchall.side_effect = [
        [("Python",)],
        [],
        [],
        [],
    ]

    with patch(
        "src.main.ai_job_matching.generate_job_matches"
    ) as mock_ai:

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 200
        assert response.get_json()["recommendations"] == []

        mock_ai.assert_not_called()


def test_empty_profile_without_resume(setup_api):
    setup_api.cursor.fetchone.side_effect = [
        (None, None),
        None,
    ]

    setup_api.cursor.fetchall.side_effect = [
        [],
        [],
        [],
        [JOB_ROW],
    ]

    with patch(
        "src.main.ai_job_matching.generate_job_matches"
    ) as mock_ai:

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 400

        mock_ai.assert_not_called()


def test_ai_service_unavailable(setup_api):
    with patch(
        "src.main.ai_job_matching.extract_resume_text",
        return_value="Python experience",
    ), patch(
        "src.main.ai_job_matching.generate_job_matches",
        side_effect=JobMatchingServiceError("Unavailable"),
    ):

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 503


def test_invalid_ai_response(setup_api):
    with patch(
        "src.main.ai_job_matching.extract_resume_text",
        return_value="Python experience",
    ), patch(
        "src.main.ai_job_matching.generate_job_matches",
        side_effect=JobMatchingResponseError("Invalid response"),
    ):

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 502


def test_database_failure(setup_api):
    setup_api.cursor.execute.side_effect = RuntimeError(
        "Database unavailable"
    )

    response = setup_api.client.post(ENDPOINT)

    assert response.status_code == 500

    setup_api.connection.close.assert_called_once()


def test_contact_information_redacted():
    text = (
        "Email: test@example.com "
        "Phone: 514-555-1234 "
        "Skills: Python"
    )

    result = redact_contact_information(text)

    assert "test@example.com" not in result
    assert "514-555-1234" not in result
    assert "[EMAIL REDACTED]" in result
    assert "[PHONE REDACTED]" in result
    assert "Python" in result


def test_resume_contact_information_not_sent_to_ai(setup_api):
    with patch(
        "src.main.ai_job_matching.extract_resume_text",
        return_value=(
            "Python developer. "
            "test@example.com 514-555-1234"
        ),
    ), patch(
        "src.main.ai_job_matching.generate_job_matches",
        return_value=[RECOMMENDATION],
    ) as mock_ai:

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 200

        resume_text = mock_ai.call_args.args[1]

        assert "test@example.com" not in resume_text
        assert "514-555-1234" not in resume_text
        assert "Python developer" in resume_text


def test_only_published_nonexpired_jobs_requested(setup_api):
    with patch(
        "src.main.ai_job_matching.extract_resume_text",
        return_value="Python experience",
    ), patch(
        "src.main.ai_job_matching.generate_job_matches",
        return_value=[RECOMMENDATION],
    ):

        response = setup_api.client.post(ENDPOINT)

        assert response.status_code == 200

        queries = [
            call.args[0]
            for call in setup_api.cursor.execute.call_args_list
        ]

        job_query = next(
            query for query in queries
            if "FROM public.jobs" in query
        )

        assert "status = 'published'" in job_query
        assert "application_deadline >= CURRENT_DATE" in job_query
