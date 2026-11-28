from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import uuid

import pytest
from flask import Flask

from src.main.interview_coordination import register_interview_coordination_routes


APPLICANT_ID = str(uuid.UUID("11111111-1111-4111-8111-111111111111"))
RECRUITER_ID = str(uuid.UUID("22222222-2222-4222-8222-222222222222"))
OTHER_ID = str(uuid.UUID("33333333-3333-4333-8333-333333333333"))
APPLICATION_ID = str(uuid.UUID("44444444-4444-4444-8444-444444444444"))
OPTION_ID = str(uuid.UUID("55555555-5555-4555-8555-555555555555"))
APPLICATION_ROW = (APPLICANT_ID, RECRUITER_ID, "Developer", "Example Co", "Interview")


@pytest.fixture
def coordination():
    app = Flask(__name__)
    app.config["TESTING"] = True
    cursor = MagicMock()
    connection = MagicMock()
    connection.cursor.return_value = cursor
    user = {"value": SimpleNamespace(id=APPLICANT_ID)}
    register_interview_coordination_routes(app, lambda: connection, lambda: user["value"])
    return app.test_client(), cursor, connection, user


def test_participant_can_load_interview_options_and_chat(coordination):
    client, cursor, _, _ = coordination
    cursor.fetchone.return_value = APPLICATION_ROW
    cursor.fetchall.side_effect = [
        [(OPTION_ID, datetime(2026, 12, 1, tzinfo=timezone.utc), APPLICANT_ID, False, datetime(2026, 11, 27, tzinfo=timezone.utc))],
        [],
    ]

    response = client.get(f"/api/applications/{APPLICATION_ID}/interview")

    assert response.status_code == 200
    body = response.get_json()
    assert body["role"] == "applicant"
    assert body["job_title"] == "Developer"
    assert body["options"][0]["id"] == OPTION_ID
    assert body["messages"] == []


def test_only_the_applicant_can_submit_future_options_and_recruiter_is_notified(coordination):
    client, cursor, connection, user = coordination
    cursor.fetchone.return_value = APPLICATION_ROW
    options = [
        (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
    ]

    response = client.post(
        f"/api/applications/{APPLICATION_ID}/interview/options",
        json={"options": options},
    )

    assert response.status_code == 201
    notification_call = next(
        call for call in cursor.execute.call_args_list
        if "INSERT INTO public.notifications" in call.args[0]
    )
    assert notification_call.args[1][0] == RECRUITER_ID
    connection.commit.assert_called_once()

    user["value"] = SimpleNamespace(id=RECRUITER_ID)
    cursor.reset_mock()
    cursor.fetchone.return_value = APPLICATION_ROW
    forbidden = client.post(
        f"/api/applications/{APPLICATION_ID}/interview/options",
        json={"options": options},
    )
    assert forbidden.status_code == 403


def test_recruiter_confirmation_notifies_both_participants(coordination):
    client, cursor, connection, user = coordination
    user["value"] = SimpleNamespace(id=RECRUITER_ID)
    cursor.fetchone.side_effect = [APPLICATION_ROW, (OPTION_ID,)]

    response = client.patch(
        f"/api/applications/{APPLICATION_ID}/interview/options/{OPTION_ID}/final",
    )

    assert response.status_code == 200
    notification_calls = [
        call for call in cursor.execute.call_args_list
        if "INSERT INTO public.notifications" in call.args[0]
    ]
    assert [call.args[1][0] for call in notification_calls] == [APPLICANT_ID, RECRUITER_ID]
    connection.commit.assert_called_once()


def test_unrelated_user_cannot_open_interview_coordination(coordination):
    client, cursor, _, user = coordination
    user["value"] = SimpleNamespace(id=OTHER_ID)
    cursor.fetchone.return_value = APPLICATION_ROW

    response = client.get(f"/api/applications/{APPLICATION_ID}/interview")

    assert response.status_code == 404
