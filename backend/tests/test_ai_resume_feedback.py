import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from src.main.ai_resume_feedback import register_ai_resume_feedback_routes


USER_ID = str(uuid.UUID("11111111-1111-4111-8111-111111111111"))
OTHER_USER_ID = str(uuid.UUID("22222222-2222-4222-8222-222222222222"))
RESUME_ID = str(uuid.UUID("33333333-3333-4333-8333-333333333333"))
UPLOADED_AT = datetime(2026, 11, 16, 10, 0, tzinfo=timezone.utc)
GENERATED_AT = datetime(2026, 11, 16, 10, 5, tzinfo=timezone.utc)
FEEDBACK = {
    "strengths": ["Clear technical skills."],
    "areas_for_improvement": ["Add measurable outcomes."],
    "recommendations": ["Quantify project impact."],
}


@pytest.fixture
def feedback_api():
    cursor = MagicMock()
    connection = MagicMock()
    connection.cursor.return_value = cursor
    storage = MagicMock()
    storage.download.return_value = b"resume bytes"
    current_user = {"value": SimpleNamespace(id=USER_ID)}
    app = Flask(__name__)
    app.config["TESTING"] = True
    register_ai_resume_feedback_routes(
        app,
        lambda: connection,
        lambda: current_user["value"],
        lambda: storage,
    )
    return app.test_client(), cursor, connection, storage, current_user


def test_post_returns_and_persists_latest_feedback(feedback_api):
    client, cursor, connection, storage, _ = feedback_api
    cursor.fetchone.side_effect = [
        (RESUME_ID, "resume.pdf", "resume/path.pdf", UPLOADED_AT),
        (GENERATED_AT,),
    ]

    with (
        patch("src.main.ai_resume_feedback.extract_resume_text", return_value="Resume text"),
        patch("src.main.ai_resume_feedback.generate_resume_feedback", return_value=FEEDBACK),
    ):
        response = client.post(f"/api/profiles/{USER_ID}/resume/feedback")

    assert response.status_code == 200
    assert response.get_json()["resume_id"] == RESUME_ID
    assert response.get_json()["strengths"] == FEEDBACK["strengths"]
    assert response.get_json()["generated_at"] == GENERATED_AT.isoformat()
    storage.download.assert_called_once_with("resume/path.pdf")
    insert_sql, insert_params = cursor.execute.call_args.args
    assert "ON CONFLICT (resume_id) DO UPDATE" in insert_sql
    assert insert_params[:2] == (RESUME_ID, UPLOADED_AT)
    connection.commit.assert_called_once()


def test_get_returns_only_feedback_for_current_resume_version(feedback_api):
    client, cursor, connection, _, _ = feedback_api
    cursor.fetchone.return_value = (
        RESUME_ID,
        FEEDBACK["strengths"],
        FEEDBACK["areas_for_improvement"],
        FEEDBACK["recommendations"],
        GENERATED_AT,
    )

    response = client.get(f"/api/profiles/{USER_ID}/resume/feedback")

    assert response.status_code == 200
    assert response.get_json()["feedback"]["resume_id"] == RESUME_ID
    assert response.get_json()["feedback"]["recommendations"] == FEEDBACK["recommendations"]
    sql, params = cursor.execute.call_args.args
    assert "f.resume_updated_at = r.uploaded_at" in sql
    assert params == (USER_ID,)
    connection.close.assert_called_once()


def test_get_returns_empty_when_no_saved_feedback(feedback_api):
    client, cursor, _, _, _ = feedback_api
    cursor.fetchone.return_value = None

    response = client.get(f"/api/profiles/{USER_ID}/resume/feedback")

    assert response.status_code == 200
    assert response.get_json() == {"feedback": None}


def test_feedback_endpoints_require_owner_access(feedback_api):
    client, cursor, connection, _, current_user = feedback_api
    current_user["value"] = SimpleNamespace(id=OTHER_USER_ID)

    response = client.get(f"/api/profiles/{USER_ID}/resume/feedback")

    assert response.status_code == 403
    connection.cursor.assert_not_called()
    cursor.execute.assert_not_called()
