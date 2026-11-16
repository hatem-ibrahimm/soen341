"""Mocked tests for Sprint 3 Issue #79 application analytics.

These verify API behavior and applicant-scoped queries, not live Supabase data.
Run from backend/: python -m pytest tests/test_application_analytics.py -v
"""

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


APPLICANT_ID = "550e8400-e29b-41d4-a716-446655440000"
OTHER_APPLICANT_ID = "e812e574-b3f8-49df-8887-099305f7e7d0"


class ApplicationAnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.cursor.fetchone.return_value = (5, 1, 2, 1, 1, 0)
        self.supabase = MagicMock()
        self.user_id = APPLICANT_ID

        def get_user(_token):
            return SimpleNamespace(user=SimpleNamespace(id=self.user_id))

        self.supabase.auth.get_user.side_effect = get_user
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer mock-token"}

    def test_requires_authentication_and_does_not_touch_database(self):
        response = self.client.get("/api/analytics/applications")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Authentication required."})
        self.connection.cursor.assert_not_called()

    def test_valid_bearer_token_is_verified_through_supabase(self):
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.supabase.auth.get_user.assert_called_once_with("mock-token")

    def test_returns_total_and_all_five_status_counts(self):
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            "total_applications": 5,
            "by_status": {
                "Applied": 1,
                "Under Review": 2,
                "Interview": 1,
                "Offered": 1,
                "Rejected": 0,
            },
        })

    def test_query_is_parameterized_and_scoped_to_current_user(self):
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("FROM public.applications", sql)
        self.assertIn("WHERE applicant_id = %s", sql)
        self.assertEqual(params, (APPLICANT_ID,))
        self.assertEqual(sql.count("FILTER (WHERE status ="), 5)

    def test_different_user_id_scopes_query_to_different_account(self):
        self.user_id = OTHER_APPLICANT_ID
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cursor.execute.call_args.args[1], (OTHER_APPLICANT_ID,))

    def test_zero_applications_returns_all_zero_counts(self):
        self.cursor.fetchone.return_value = (0, 0, 0, 0, 0, 0)
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["total_applications"], 0)
        self.assertEqual(data["by_status"], {
            "Applied": 0,
            "Under Review": 0,
            "Interview": 0,
            "Offered": 0,
            "Rejected": 0,
        })

    def test_all_applications_can_have_same_status(self):
        self.cursor.fetchone.return_value = (7, 0, 0, 0, 0, 7)
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["by_status"]["Rejected"], 7)

    def test_rejects_malformed_authenticated_user_id(self):
        self.user_id = "not-a-uuid"
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.connection.cursor.assert_not_called()

    def test_database_connection_failure_returns_generic_500(self):
        def fail_connection():
            raise RuntimeError("database credentials leaked in exception")
        self.app.config["DB_CONNECTION_FACTORY"] = fail_connection
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("credentials", str(response.get_json()))

    def test_sql_failure_closes_connection_and_cursor(self):
        self.cursor.execute.side_effect = RuntimeError("query failed")
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_unexpected_empty_result_returns_500(self):
        self.cursor.fetchone.return_value = None
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.connection.close.assert_called_once()

    def test_inconsistent_status_totals_fail_explicitly(self):
        self.cursor.fetchone.return_value = (8, 1, 2, 1, 1, 0)
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 500)

    def test_rejects_negative_and_noninteger_database_counts(self):
        for row in ((1, -1, 0, 0, 0, 0), (1, 1.0, 0, 0, 0, 0), (0, None, 0, 0, 0, 0)):
            with self.subTest(row=row):
                self.cursor.fetchone.return_value = row
                response = self.client.get("/api/analytics/applications", headers=self.headers)
                self.assertEqual(response.status_code, 500)

    def test_does_not_modify_application_records(self):
        self.client.get("/api/analytics/applications", headers=self.headers)
        self.connection.commit.assert_not_called()
        self.connection.rollback.assert_not_called()
        sql, _ = self.cursor.execute.call_args.args
        self.assertNotIn("UPDATE ", sql.upper())
        self.assertNotIn("INSERT ", sql.upper())
        self.assertNotIn("DELETE ", sql.upper())

    def test_success_closes_cursor_and_connection(self):
        response = self.client.get("/api/analytics/applications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
