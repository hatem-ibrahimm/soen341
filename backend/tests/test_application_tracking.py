
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


APPLICANT_ID = "550e8400-e29b-41d4-a716-446655440000"
RECRUITER_ID = "5d901892-0103-49a2-9d77-5e31f9b3d3c1"
JOB_ID = "8cb0abe6-2c39-45dc-a700-3cf2bd28592b"
APPLICATION_ID = "e4be1505-c45b-4f1c-9068-8dbd91a86dd5"
SECOND_APPLICATION_ID = "b340c212-c8c7-42ad-a565-973964636f95"
CREATED_AT = datetime(2026, 10, 25, 20, 0, tzinfo=timezone.utc)


class ApplicationTrackingTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.supabase = MagicMock()
        self.current_user_id = APPLICANT_ID

        def get_user(_token):
            return SimpleNamespace(
                user=SimpleNamespace(id=self.current_user_id, email="user@example.com")
            )

        self.supabase.auth.get_user.side_effect = get_user
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer mock-token"}
        self.row = (
            APPLICATION_ID, APPLICANT_ID, JOB_ID,
            None, "Applied", CREATED_AT,
        )

    def test_list_requires_authentication_and_does_not_access_db(self):
        response = self.client.get("/api/applications")
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_list_returns_only_my_applications_with_pagination(self):
        self.cursor.fetchall.return_value = [self.row]
        response = self.client.get("/api/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["applications"][0]["applicant_id"], APPLICANT_ID)
        self.assertEqual(body["applications"][0]["status"], "Applied")
        self.assertEqual(body["applications"][0]["submitted_at"], CREATED_AT.isoformat())
        self.assertEqual(body["pagination"], {"limit": 20, "offset": 0, "has_more": False})
        sql, parameters = self.cursor.execute.call_args.args
        self.assertIn("WHERE applicant_id = %s", sql)
        self.assertEqual(parameters, (APPLICANT_ID, 21, 0))
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_list_filtered_by_status_and_paginated(self):
        self.cursor.fetchall.return_value = [
            (APPLICATION_ID, APPLICANT_ID, JOB_ID, None, "Interview", CREATED_AT),
            (SECOND_APPLICATION_ID, APPLICANT_ID, JOB_ID, None, "Interview", CREATED_AT),
        ]
        response = self.client.get(
            "/api/applications?status=Interview&limit=1&offset=2",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["applications"]), 1)
        self.assertEqual(
            response.get_json()["pagination"],
            {"limit": 1, "offset": 2, "has_more": True},
        )
        sql, parameters = self.cursor.execute.call_args.args
        self.assertIn("applicant_id = %s AND status = %s", sql)
        self.assertEqual(parameters, (APPLICANT_ID, "Interview", 2, 2))

    def test_list_empty_returns_empty_array(self):
        self.cursor.fetchall.return_value = []
        response = self.client.get("/api/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["applications"], [])
        self.assertFalse(response.get_json()["pagination"]["has_more"])

    def test_list_rejects_bad_filters_before_database_access(self):
        for path in (
            "/api/applications?status=Wrong",
            "/api/applications?limit=0",
            "/api/applications?limit=101",
            "/api/applications?limit=hello",
            "/api/applications?offset=-1",
            "/api/applications?offset=100001",
            "/api/applications?offset=1.1",
        ):
            with self.subTest(path=path):
                response = self.client.get(path, headers=self.headers)
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_detail_requires_authentication(self):
        response = self.client.get(f"/api/applications/{APPLICATION_ID}")
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_detail_rejects_bad_application_id(self):
        response = self.client.get("/api/applications/not-a-uuid", headers=self.headers)
        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_detail_returns_own_application_only(self):
        self.cursor.fetchone.return_value = self.row
        response = self.client.get(f"/api/applications/{APPLICATION_ID}", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["application"]["id"], APPLICATION_ID)
        sql, parameters = self.cursor.execute.call_args.args
        self.assertIn("WHERE id = %s AND applicant_id = %s", sql)
        self.assertEqual(parameters, (APPLICATION_ID, APPLICANT_ID))
        self.connection.close.assert_called_once()

    def test_detail_does_not_reveal_another_users_application(self):
        self.cursor.fetchone.return_value = None
        response = self.client.get(f"/api/applications/{APPLICATION_ID}", headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.connection.close.assert_called_once()

    def test_update_requires_authentication(self):
        response = self.client.patch(
            f"/api/applications/{APPLICATION_ID}/status",
            json={"status": "Interview"},
        )
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_update_rejects_invalid_id_body_or_status(self):
        requests = (
            ("/api/applications/bad-id/status", {"status": "Interview"}),
            (f"/api/applications/{APPLICATION_ID}/status", {}),
            (f"/api/applications/{APPLICATION_ID}/status", {"status": "Hired"}),
            (f"/api/applications/{APPLICATION_ID}/status", {"status": "interview"}),
            (f"/api/applications/{APPLICATION_ID}/status", {"status": ["Applied"]}),
        )
        for path, data in requests:
            with self.subTest(path=path, data=data):
                response = self.client.patch(path, json=data, headers=self.headers)
                self.assertEqual(response.status_code, 400)
        text_response = self.client.patch(
            f"/api/applications/{APPLICATION_ID}/status",
            data="not JSON", content_type="text/plain", headers=self.headers,
        )
        self.assertEqual(text_response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_authorized_recruiter_can_update_status(self):
        self.current_user_id = RECRUITER_ID
        updated_row = (
            APPLICATION_ID, APPLICANT_ID, JOB_ID, None, "Interview", CREATED_AT,
        )
        self.cursor.fetchone.return_value = updated_row
        response = self.client.patch(
            f"/api/applications/{APPLICATION_ID}/status",
            json={"status": "Interview"}, headers=self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["application"]["status"], "Interview")
        sql, parameters = self.cursor.execute.call_args.args
        self.assertIn("UPDATE applications AS a", sql)
        self.assertIn("j.recruiter_id = %s", sql)
        self.assertEqual(parameters, ("Interview", APPLICATION_ID, RECRUITER_ID))
        self.connection.commit.assert_called_once()
        self.connection.close.assert_called_once()

    def test_unrelated_account_cannot_change_application_status(self):
        self.current_user_id = RECRUITER_ID
        self.cursor.fetchone.return_value = None  # ownership guard matches no row
        response = self.client.patch(
            f"/api/applications/{APPLICATION_ID}/status",
            json={"status": "Offered"}, headers=self.headers,
        )
        self.assertEqual(response.status_code, 404)
        self.connection.commit.assert_not_called()
        self.connection.rollback.assert_called_once()

    def test_list_database_failure_returns_safe_error(self):
        self.cursor.execute.side_effect = RuntimeError("private credentials")
        response = self.client.get("/api/applications", headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("private credentials", response.get_json()["error"])
        self.connection.close.assert_called_once()

    def test_update_database_failure_rolls_back(self):
        self.cursor.execute.side_effect = RuntimeError("private credentials")
        response = self.client.patch(
            f"/api/applications/{APPLICATION_ID}/status",
            json={"status": "Rejected"}, headers=self.headers,
        )
        self.assertEqual(response.status_code, 500)
        self.connection.rollback.assert_called_once()
        self.connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
