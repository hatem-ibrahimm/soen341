"""Unit tests for the isolated Sprint 2 application-submission endpoint.

These tests use mocks and do NOT demonstrate integration with Hatem's actual
PostgreSQL schema; that integration must be verified separately.
"""

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


USER_ID = "550e8400-e29b-41d4-a716-446655440000"
JOB_ID = "8cb0abe6-2c39-45dc-a700-3cf2bd28592b"
RESUME_ID = "8cb0abe6-2c39-45dc-a700-3cf2bd28592c"
APPLICATION_ID = "e4be1505-c45b-4f1c-9068-8dbd91a86dd5"


class SubmitApplicationTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.supabase = MagicMock()
        self.supabase.auth.get_user.return_value = SimpleNamespace(
            user=SimpleNamespace(id=USER_ID, email="applicant@example.com")
        )
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer fake-test-token"}
        self.application_row = (
            APPLICATION_ID, USER_ID, JOB_ID, None,
            "Applied", datetime(2026, 10, 25, 20, 0, tzinfo=timezone.utc)
        )

    def _rows(self, *rows):
        self.cursor.fetchone.side_effect = rows

    def _submit(self, data=None, authenticated=True):
        return self.client.post(
            "/api/applications",
            json={"job_id": JOB_ID} if data is None else data,
            headers=self.headers if authenticated else {},
        )

    def test_requires_authentication_before_database_access(self):
        response = self._submit(authenticated=False)
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_rejects_non_json_body(self):
        response = self.client.post(
            "/api/applications", data="hello", headers=self.headers,
            content_type="text/plain"
        )
        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_rejects_missing_or_invalid_job_id(self):
        for payload in ({}, {"job_id": "not-a-uuid"}):
            with self.subTest(payload=payload):
                response = self._submit(payload)
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_rejects_invalid_resume_id(self):
        response = self._submit({"job_id": JOB_ID, "resume_id": "abc"})
        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_rejects_nontext_or_overlong_cover_letter(self):
        for cover_letter in (22, "x" * 2001):
            with self.subTest(value=type(cover_letter).__name__):
                response = self._submit({"job_id": JOB_ID, "cover_letter": cover_letter})
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_job_must_exist_and_be_open(self):
        self._rows(None)
        response = self._submit()
        self.assertEqual(response.status_code, 404)
        self.cursor.execute.assert_called_once_with(
            "SELECT id FROM jobs WHERE id = %s AND status = %s",
            (JOB_ID, "open"),
        )
        self.connection.commit.assert_not_called()
        self.connection.close.assert_called_once()

    def test_success_uses_authenticated_user_not_body_applicant_id(self):
        self._rows((JOB_ID,), self.application_row)
        response = self._submit({"job_id": JOB_ID, "applicant_id": "fake-user-id", "cover_letter": " Hello! "})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["application"]["status"], "Applied")
        self.assertEqual(response.get_json()["application"]["applicant_id"], USER_ID)
        self.assertEqual(response.get_json()["application"]["submitted_at"], "2026-10-25T20:00:00+00:00")
        self.assertEqual(self.cursor.execute.call_count, 2)
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("INSERT INTO applications", sql)
        self.assertEqual(params, (USER_ID, JOB_ID, None, "Hello!", "Applied"))
        self.connection.commit.assert_called_once()
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_success_with_owned_resume(self):
        row = (APPLICATION_ID, USER_ID, JOB_ID, RESUME_ID, "Applied", datetime.now(timezone.utc))
        self._rows((JOB_ID,), (RESUME_ID,), row)
        response = self._submit({"job_id": JOB_ID, "resume_id": RESUME_ID})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.cursor.execute.call_count, 3)
        second_sql, second_params = self.cursor.execute.call_args_list[1].args
        self.assertIn("FROM resumes", second_sql)
        self.assertEqual(second_params, (RESUME_ID, USER_ID))
        self.assertEqual(response.get_json()["application"]["resume_id"], RESUME_ID)

    def test_cannot_submit_another_users_resume(self):
        self._rows((JOB_ID,), None)
        response = self._submit({"job_id": JOB_ID, "resume_id": RESUME_ID})
        self.assertEqual(response.status_code, 404)
        self.connection.commit.assert_not_called()
        self.assertEqual(self.cursor.execute.call_count, 2)

    def test_duplicate_submission_returns_conflict(self):
        err = Exception("duplicate")
        err.pgcode = "23505"
        self._rows((JOB_ID,))
        self.cursor.execute.side_effect = [None, err]
        response = self._submit()
        self.assertEqual(response.status_code, 409)
        self.connection.rollback.assert_called_once()
        self.connection.close.assert_called_once()

    def test_db_failure_returns_safe_error_and_rolls_back(self):
        self._rows((JOB_ID,))
        self.cursor.execute.side_effect = [None, RuntimeError("DB secret internal failure")]
        response = self._submit()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("DB secret", response.get_json()["error"])
        self.connection.rollback.assert_called_once()
        self.connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
