"""Mocked Flask tests for Sprint 3 Issue #80.

Run from backend/: python -m pytest tests/test_application_history.py -v
These validate endpoint behavior, not a live Supabase/PostgreSQL deployment.
"""

import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


APPLICANT = "550e8400-e29b-41d4-a716-446655440000"
OTHER_APPLICANT = "e812e574-b3f8-49df-8887-099305f7e7d0"
APPLICATION_ID = "a5b8da0a-6000-4cd7-a677-cc12eb21df66"
SUBMITTED = datetime(2026, 11, 12, 16, 30, tzinfo=timezone.utc)
HISTORY_ROW = (APPLICATION_ID, 42, "Backend Developer", "Example Inc.", "Applied", SUBMITTED)


class ApplicationHistoryTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.cursor.fetchall.return_value = [HISTORY_ROW]
        self.supabase = MagicMock()
        self.user_id = APPLICANT
        self.supabase.auth.get_user.side_effect = lambda token: SimpleNamespace(
            user=SimpleNamespace(id=self.user_id)
        )
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer test-token"}

    def get_history(self, query=""):
        return self.client.get("/api/analytics/applications/history" + query,
                               headers=self.headers)

    def test_history_requires_authentication(self):
        response = self.client.get("/api/analytics/applications/history")
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_history_verifies_token_with_supabase(self):
        response = self.get_history()
        self.assertEqual(response.status_code, 200)
        self.supabase.auth.get_user.assert_called_once_with("test-token")

    def test_history_returns_job_details_and_iso_timestamp(self):
        response = self.get_history()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            "history": [{
                "id": APPLICATION_ID,
                "job_id": 42,
                "job_title": "Backend Developer",
                "company_name": "Example Inc.",
                "status": "Applied",
                "submitted_at": "2026-11-12T16:30:00+00:00",
            }],
            "pagination": {"limit": 20, "offset": 0, "has_more": False},
        })

    def test_history_query_uses_join_order_and_applicant_scope(self):
        response = self.get_history()
        self.assertEqual(response.status_code, 200)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("JOIN public.jobs", sql)
        self.assertIn("a.applicant_id = %s", sql)
        self.assertIn("ORDER BY a.created_at DESC", sql)
        self.assertEqual(params, (APPLICANT, 21, 0))

    def test_history_uses_authenticated_id_not_caller_specified_id(self):
        response = self.get_history("?applicant_id=" + OTHER_APPLICANT)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cursor.execute.call_args.args[1][0], APPLICANT)
        self.user_id = OTHER_APPLICANT
        self.get_history()
        self.assertEqual(self.cursor.execute.call_args.args[1][0], OTHER_APPLICANT)

    def test_history_valid_date_range_is_inclusive_in_utc(self):
        response = self.get_history("?start_date=2026-11-01&end_date=2026-11-12")
        self.assertEqual(response.status_code, 200)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("a.created_at >= %s", sql)
        self.assertIn("a.created_at < %s", sql)
        self.assertEqual(params[1], datetime(2026, 11, 1, tzinfo=timezone.utc))
        self.assertEqual(params[2], datetime(2026, 11, 13, tzinfo=timezone.utc))

    def test_history_single_date_range(self):
        self.assertEqual(self.get_history("?start_date=2026-11-12&end_date=2026-11-12").status_code, 200)

    def test_history_status_filter(self):
        response = self.get_history("?status=Under%20Review")
        self.assertEqual(response.status_code, 200)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("a.status = %s", sql)
        self.assertIn("Under Review", params)

    def test_history_rejects_bad_status_before_query(self):
        self.assertEqual(self.get_history("?status=Unknown").status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_history_rejects_invalid_calendar_dates(self):
        for q in ("?start_date=2026-02-30", "?start_date=20261112",
                  "?end_date=2026-13-01", "?end_date=9999-12-31"):
            with self.subTest(q=q):
                self.assertEqual(self.get_history(q).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_history_rejects_reversed_date_range(self):
        self.assertEqual(self.get_history("?start_date=2026-11-15&end_date=2026-11-01").status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_history_rejects_invalid_pagination(self):
        for q in ("?limit=0", "?limit=101", "?limit=-1", "?limit=1.5",
                  "?offset=-1", "?offset=100001", "?offset=abc"):
            with self.subTest(q=q):
                self.assertEqual(self.get_history(q).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_history_pagination_has_more_when_over_limit(self):
        self.cursor.fetchall.return_value = [HISTORY_ROW] * 3
        response = self.get_history("?limit=2&offset=3")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["history"]), 2)
        self.assertTrue(response.get_json()["pagination"]["has_more"])
        self.assertEqual(self.cursor.execute.call_args.args[1][-2:], (3, 3))

    def test_history_empty_dataset_returns_success(self):
        self.cursor.fetchall.return_value = []
        response = self.get_history()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["history"], [])
        self.assertFalse(response.get_json()["pagination"]["has_more"])

    def test_history_rejects_invalid_authenticated_uuid(self):
        self.user_id = "invalid"
        response = self.get_history()
        self.assertEqual(response.status_code, 500)
        self.connection.cursor.assert_not_called()

    def test_history_database_error_is_sanitized_and_resources_closed(self):
        self.cursor.execute.side_effect = RuntimeError("secret password db error")
        response = self.get_history()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret", str(response.get_json()))
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_history_invalid_row_returns_server_error(self):
        self.cursor.fetchall.return_value = [(APPLICATION_ID,)]
        self.assertEqual(self.get_history().status_code, 500)

    def test_history_is_read_only(self):
        self.get_history()
        sql, _ = self.cursor.execute.call_args.args
        self.assertNotIn("UPDATE ", sql.upper())
        self.assertNotIn("INSERT ", sql.upper())
        self.assertNotIn("DELETE ", sql.upper())
        self.connection.commit.assert_not_called()


class ApplicationActivityTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.cursor.fetchall.return_value = [(date(2026, 11, 1), 2), (date(2026, 12, 1), 3)]
        self.supabase = MagicMock()
        self.user_id = APPLICANT
        self.supabase.auth.get_user.side_effect = lambda token: SimpleNamespace(
            user=SimpleNamespace(id=self.user_id)
        )
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer test-token"}

    def get_activity(self, query=""):
        return self.client.get("/api/analytics/applications/activity" + query,
                               headers=self.headers)

    def test_activity_requires_authentication(self):
        response = self.client.get("/api/analytics/applications/activity")
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_activity_returns_monthly_counts_and_total(self):
        response = self.get_activity()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            "group_by": "month",
            "total_applications": 5,
            "periods": [
                {"period_start": "2026-11-01", "applications": 2},
                {"period_start": "2026-12-01", "applications": 3},
            ],
        })

    def test_weekly_grouping_is_parameterized_and_utc(self):
        self.cursor.fetchall.return_value = [(date(2026, 11, 9), 3)]
        response = self.get_activity("?group_by=week")
        self.assertEqual(response.status_code, 200)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("AT TIME ZONE 'UTC'", sql)
        self.assertIn("GROUP BY 1", sql)
        self.assertEqual(params, ("week", APPLICANT))
        self.assertEqual(response.get_json()["periods"][0]["period_start"], "2026-11-09")

    def test_activity_query_is_scoped_to_authenticated_user(self):
        self.get_activity()
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("a.applicant_id = %s", sql)
        self.assertEqual(params, ("month", APPLICANT))

    def test_activity_respects_utc_date_filters(self):
        response = self.get_activity("?start_date=2026-11-01&end_date=2026-11-30")
        self.assertEqual(response.status_code, 200)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("a.created_at >= %s", sql)
        self.assertIn("a.created_at < %s", sql)
        self.assertEqual(params[2], datetime(2026, 11, 1, tzinfo=timezone.utc))
        self.assertEqual(params[3], datetime(2026, 12, 1, tzinfo=timezone.utc))

    def test_activity_empty_returns_zero_total(self):
        self.cursor.fetchall.return_value = []
        response = self.get_activity()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["periods"], [])
        self.assertEqual(response.get_json()["total_applications"], 0)

    def test_activity_rejects_invalid_grouping(self):
        for q in ("?group_by=day", "?group_by=week;DROP", "?group_by="):
            with self.subTest(q=q):
                self.assertEqual(self.get_activity(q).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_activity_rejects_bad_or_reversed_dates(self):
        for q in ("?start_date=invalid", "?end_date=2026-02-30",
                  "?start_date=2026-11-15&end_date=2026-11-01"):
            with self.subTest(q=q):
                self.assertEqual(self.get_activity(q).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_activity_returns_server_error_for_invalid_uuid(self):
        self.user_id = "invalid"
        self.assertEqual(self.get_activity().status_code, 500)
        self.connection.cursor.assert_not_called()

    def test_activity_rejects_invalid_counts(self):
        for rows in ([(date(2026, 11, 1), -1)], [(date(2026, 11, 1), 1.5)]):
            with self.subTest(rows=rows):
                self.cursor.fetchall.return_value = rows
                self.assertEqual(self.get_activity().status_code, 500)

    def test_activity_database_error_is_sanitized(self):
        self.cursor.execute.side_effect = RuntimeError("secret database configuration")
        response = self.get_activity()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("secret", str(response.get_json()))
        self.connection.close.assert_called_once()

    def test_activity_is_read_only_and_closes_resources(self):
        response = self.get_activity()
        self.assertEqual(response.status_code, 200)
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()
        self.connection.commit.assert_not_called()
        sql, _ = self.cursor.execute.call_args.args
        self.assertNotIn("UPDATE ", sql.upper())
        self.assertNotIn("INSERT ", sql.upper())
        self.assertNotIn("DELETE ", sql.upper())


if __name__ == "__main__":
    unittest.main()
