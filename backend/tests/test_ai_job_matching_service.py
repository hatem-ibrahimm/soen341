
import json
from unittest.mock import patch

import pytest

from src.main.ai_job_matching_service import (
    generate_job_matches,
    validate_job_matches,
    JobMatchingServiceError,
    JobMatchingResponseError,
)


PROFILE = {
    "title": "Software Engineering Student",
    "skills": ["Python", "C++", "SQL"],
    "education": [],
    "work_experience": [],
}

RESUME_TEXT = "Experience developing applications using Python."

JOBS = [
    {
        "id": 1,
        "title": "Python Developer",
        "required_skills": ["Python", "SQL"],
    },
    {
        "id": 2,
        "title": "C++ Developer",
        "required_skills": ["C++", "Git"],
    },
]


def make_recommendation(job_id=1, score=90):
    return {
        "job_id": job_id,
        "match_score": score,
        "matching_skills": ["Python"],
        "missing_skills": ["SQL"],
        "explanation": "Relevant programming experience.",
    }


@pytest.fixture(autouse=True)
def configure_environment(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-test-key")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")

    monkeypatch.setattr(
        "src.main.ai_job_matching_service.load_dotenv",
        lambda *args, **kwargs: None,
    )


def test_generate_job_matches_success():
    recommendation = make_recommendation()

    with patch("google.genai.Client") as mock_client:
        response = (
            mock_client.return_value.models
            .generate_content.return_value
        )

        response.text = json.dumps({
            "recommendations": [recommendation]
        })

        result = generate_job_matches(
            PROFILE, RESUME_TEXT, JOBS
        )

        assert result == [recommendation]


def test_generate_matches_without_resume():
    with patch("google.genai.Client") as mock_client:
        response = (
            mock_client.return_value.models
            .generate_content.return_value
        )

        response.text = json.dumps({
            "recommendations": [make_recommendation()]
        })

        result = generate_job_matches(PROFILE, "", JOBS)

        assert len(result) == 1

        call = (
            mock_client.return_value.models
            .generate_content.call_args
        )

        input_data = json.loads(call.kwargs["contents"])

        assert input_data["resume_text"] == ""
        assert input_data["profile"] == PROFILE


def test_no_available_jobs():
    with patch("google.genai.Client") as mock_client:
        result = generate_job_matches(
            PROFILE, RESUME_TEXT, []
        )

        assert result == []
        mock_client.assert_not_called()


def test_missing_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with pytest.raises(JobMatchingServiceError):
        generate_job_matches(PROFILE, RESUME_TEXT, JOBS)


def test_ai_service_unavailable():
    with patch("google.genai.Client") as mock_client:
        mock_client.return_value.models.generate_content.side_effect = (
            RuntimeError("503 Service Unavailable")
        )

        with pytest.raises(JobMatchingServiceError):
            generate_job_matches(
                PROFILE, RESUME_TEXT, JOBS
            )


def test_invalid_json_response():
    with patch("google.genai.Client") as mock_client:
        response = (
            mock_client.return_value.models
            .generate_content.return_value
        )

        response.text = "Invalid JSON"

        with pytest.raises(JobMatchingResponseError):
            generate_job_matches(
                PROFILE, RESUME_TEXT, JOBS
            )


def test_unknown_job_id_rejected():
    result = {
        "recommendations": [
            make_recommendation(job_id=999)
        ]
    }

    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(result, JOBS)


def test_duplicate_job_id_rejected():
    result = {
        "recommendations": [
            make_recommendation(job_id=1),
            make_recommendation(job_id=1),
        ]
    }

    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(result, JOBS)


@pytest.mark.parametrize(
    "score", [-1, 101, "90", None, True]
)
def test_invalid_match_score_rejected(score):
    result = {
        "recommendations": [
            make_recommendation(score=score)
        ]
    }

    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(result, JOBS)


def test_invalid_matching_skills_rejected():
    recommendation = make_recommendation()
    recommendation["matching_skills"] = "Python"

    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(
            {"recommendations": [recommendation]},
            JOBS,
        )


def test_invalid_missing_skills_rejected():
    recommendation = make_recommendation()
    recommendation["missing_skills"] = [None]

    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(
            {"recommendations": [recommendation]},
            JOBS,
        )


def test_empty_explanation_rejected():
    recommendation = make_recommendation()
    recommendation["explanation"] = " "

    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(
            {"recommendations": [recommendation]},
            JOBS,
        )


def test_recommendations_sorted_by_score():
    result = {
        "recommendations": [
            make_recommendation(job_id=1, score=70),
            make_recommendation(job_id=2, score=95),
        ]
    }

    matches = validate_job_matches(result, JOBS)

    assert matches[0]["job_id"] == 2
    assert matches[1]["job_id"] == 1


def test_maximum_five_recommendations():
    jobs = [{"id": i} for i in range(1, 8)]

    result = {
        "recommendations": [
            make_recommendation(job_id=i, score=80)
            for i in range(1, 8)
        ]
    }

    matches = validate_job_matches(result, jobs)

    assert len(matches) == 5


def test_empty_recommendations_accepted():
    result = validate_job_matches(
        {"recommendations": []},
        JOBS,
    )

    assert result == []


@pytest.mark.parametrize(
    "result",
    [None, [], {}, {"recommendations": "invalid"}],
)
def test_invalid_response_structure(result):
    with pytest.raises(JobMatchingResponseError):
        validate_job_matches(result, JOBS)
