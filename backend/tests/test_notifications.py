import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from flask import Flask

from src.main.notifications import register_notification_routes


# Sample IDs used throughout the tests
USER_ID = str(uuid.UUID("11111111-1111-4111-8111-111111111111"))
NOTIFICATION_ID = str(uuid.UUID("33333333-3333-4333-8333-333333333333"))
APPLICATION_ID = str(uuid.UUID("44444444-4444-4444-8444-444444444444"))


@pytest.fixture
def setup_notifications():
    """Create a Flask test app with fake authentication and database."""

    app = Flask(__name__)
    app.config["TESTING"] = True

    # Mock the PostgreSQL database connection
    cursor = MagicMock()
    connection = MagicMock()
    connection.cursor.return_value = cursor

    # Simulate a logged-in user
    current_user = {"value": SimpleNamespace(id=USER_ID)}

    def get_current_user():
        return current_user["value"]

    # Register the notification endpoints
    register_notification_routes(
        app,
        lambda: connection,
        get_current_user
    )

    return app.test_client(), cursor, connection, current_user


# --------------------------------------------------
# GET NOTIFICATIONS TESTS
# --------------------------------------------------

def test_get_notifications_success(setup_notifications):
    """A logged-in user can retrieve their notifications."""

    client, cursor, connection, _ = setup_notifications

    cursor.fetchall.return_value = [
        (
            NOTIFICATION_ID,
            APPLICATION_ID,
            "application_status",
            "Application Status Updated",
            "Your application status has changed to Interview.",
            False,
            SimpleNamespace(
                isoformat=lambda: "2026-11-13T10:00:00+00:00"
            ),
        )
    ]

    response = client.get("/api/notifications")

    assert response.status_code == 200

    notifications = response.get_json()["notifications"]

    assert len(notifications) == 1
    assert notifications[0]["id"] == NOTIFICATION_ID
    assert notifications[0]["type"] == "application_status"
    assert notifications[0]["is_read"] is False

    # Verify the SQL query filters by the logged-in user
    sql, params = cursor.execute.call_args.args
    assert "WHERE user_id = %s" in sql
    assert params == (USER_ID,)

    cursor.close.assert_called_once()
    connection.close.assert_called_once()


def test_get_notifications_empty(setup_notifications):
    """Return an empty list when the user has no notifications."""

    client, cursor, _, _ = setup_notifications

    cursor.fetchall.return_value = []

    response = client.get("/api/notifications")

    assert response.status_code == 200
    assert response.get_json() == {"notifications": []}


def test_get_notifications_requires_authentication(setup_notifications):
    """Unauthenticated users cannot retrieve notifications."""

    client, cursor, _, current_user = setup_notifications

    current_user["value"] = None

    response = client.get("/api/notifications")

    assert response.status_code == 401
    cursor.execute.assert_not_called()


def test_get_notifications_database_error(setup_notifications):
    """Return an error when notification retrieval fails."""

    client, cursor, connection, _ = setup_notifications

    cursor.execute.side_effect = RuntimeError("Database unavailable")

    response = client.get("/api/notifications")

    assert response.status_code == 500
    assert "error" in response.get_json()

    connection.close.assert_called_once()


def test_get_notifications_invalid_user_id(setup_notifications):
    """Reject an invalid authenticated user ID."""

    client, cursor, _, current_user = setup_notifications

    current_user["value"] = SimpleNamespace(id="invalid-user-id")

    response = client.get("/api/notifications")

    assert response.status_code == 500
    cursor.execute.assert_not_called()


def test_get_notifications_without_application_id(setup_notifications):
    """Notifications without an associated application are supported."""

    client, cursor, _, _ = setup_notifications

    cursor.fetchall.return_value = [
        (
            NOTIFICATION_ID,
            None,
            "deadline_reminder",
            "Upcoming Deadline",
            "A job application deadline is approaching.",
            True,
            SimpleNamespace(
                isoformat=lambda: "2026-11-13T11:00:00+00:00"
            ),
        )
    ]

    response = client.get("/api/notifications")

    assert response.status_code == 200

    notification = response.get_json()["notifications"][0]

    assert notification["application_id"] is None
    assert notification["is_read"] is True
    assert notification["created_at"] == "2026-11-13T11:00:00+00:00"


# --------------------------------------------------
# UNREAD NOTIFICATION COUNT TESTS
# --------------------------------------------------

def test_unread_count_success(setup_notifications):
    """Return the number of unread notifications."""

    client, cursor, _, _ = setup_notifications

    cursor.fetchone.return_value = (3,)

    response = client.get("/api/notifications/unread-count")

    assert response.status_code == 200
    assert response.get_json() == {"unread_count": 3}

    sql, params = cursor.execute.call_args.args

    assert "is_read = FALSE" in sql
    assert params == (USER_ID,)


def test_unread_count_zero(setup_notifications):
    """Return zero when all notifications have been read."""

    client, cursor, _, _ = setup_notifications

    cursor.fetchone.return_value = (0,)

    response = client.get("/api/notifications/unread-count")

    assert response.status_code == 200
    assert response.get_json() == {"unread_count": 0}


def test_unread_count_requires_authentication(setup_notifications):
    """Unauthenticated users cannot view unread counts."""

    client, cursor, _, current_user = setup_notifications

    current_user["value"] = None

    response = client.get("/api/notifications/unread-count")

    assert response.status_code == 401
    cursor.execute.assert_not_called()


def test_unread_count_database_error(setup_notifications):
    """Handle database errors when counting unread notifications."""

    client, cursor, connection, _ = setup_notifications

    cursor.execute.side_effect = RuntimeError("Database unavailable")

    response = client.get("/api/notifications/unread-count")

    assert response.status_code == 500
    assert "error" in response.get_json()

    connection.close.assert_called_once()


def test_unread_count_invalid_user_id(setup_notifications):
    """Reject invalid authenticated user IDs."""

    client, cursor, _, current_user = setup_notifications

    current_user["value"] = SimpleNamespace(id="invalid-user-id")

    response = client.get("/api/notifications/unread-count")

    assert response.status_code == 500
    cursor.execute.assert_not_called()


# --------------------------------------------------
# MARK NOTIFICATION AS READ TESTS
# --------------------------------------------------

def test_mark_notification_read_success(setup_notifications):
    """A user can mark their own notification as read."""

    client, cursor, connection, _ = setup_notifications

    cursor.fetchone.return_value = (NOTIFICATION_ID,)

    response = client.patch(
        f"/api/notifications/{NOTIFICATION_ID}/read"
    )

    assert response.status_code == 200
    assert response.get_json()["message"] == (
        "Notification marked as read."
    )

    sql, params = cursor.execute.call_args.args

    assert "SET is_read = TRUE" in sql
    assert "WHERE id = %s AND user_id = %s" in sql
    assert params == (NOTIFICATION_ID, USER_ID)

    connection.commit.assert_called_once()


def test_mark_notification_read_not_owned_by_user(setup_notifications):
    """Users cannot mark another user's notification as read."""

    client, cursor, connection, _ = setup_notifications

    # No matching row means missing or not owned by this user
    cursor.fetchone.return_value = None

    response = client.patch(
        f"/api/notifications/{NOTIFICATION_ID}/read"
    )

    assert response.status_code == 404

    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()

    # Verify ownership is checked in the SQL query
    assert cursor.execute.call_args.args[1] == (
        NOTIFICATION_ID,
        USER_ID
    )


def test_mark_notification_read_invalid_id(setup_notifications):
    """Reject notification IDs that are not valid UUIDs."""

    client, cursor, _, _ = setup_notifications

    response = client.patch(
        "/api/notifications/not-a-uuid/read"
    )

    assert response.status_code == 400
    cursor.execute.assert_not_called()


def test_mark_notification_read_requires_authentication(setup_notifications):
    """Unauthenticated users cannot update notifications."""

    client, cursor, _, current_user = setup_notifications

    current_user["value"] = None

    response = client.patch(
        f"/api/notifications/{NOTIFICATION_ID}/read"
    )

    assert response.status_code == 401
    cursor.execute.assert_not_called()


def test_mark_notification_read_database_error(setup_notifications):
    """Roll back the transaction if the database update fails."""

    client, cursor, connection, _ = setup_notifications

    cursor.execute.side_effect = RuntimeError("Database unavailable")

    response = client.patch(
        f"/api/notifications/{NOTIFICATION_ID}/read"
    )

    assert response.status_code == 500

    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()


def test_mark_notification_read_invalid_user_id(setup_notifications):
    """Reject an invalid authenticated user ID."""

    client, cursor, _, current_user = setup_notifications

    current_user["value"] = SimpleNamespace(id="invalid-user-id")

    response = client.patch(
        f"/api/notifications/{NOTIFICATION_ID}/read"
    )

    assert response.status_code == 500
    cursor.execute.assert_not_called()


def test_mark_notification_read_closes_resources(setup_notifications):
    """Database resources are closed after a successful update."""

    client, cursor, connection, _ = setup_notifications

    cursor.fetchone.return_value = (NOTIFICATION_ID,)

    response = client.patch(
        f"/api/notifications/{NOTIFICATION_ID}/read"
    )

    assert response.status_code == 200

    cursor.close.assert_called_once()
    connection.close.assert_called_once()