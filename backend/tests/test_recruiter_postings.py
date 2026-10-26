"""Mocked backend tests for Issue #43 recruiter job posting APIs.

These do not prove the deployed jobs table matches the documented schema.
"""

import unittest
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


RECRUITER_ID = "550e8400-e29b-41d4-a716-446655440000"
CREATED_AT = datetime(2026, 10, 25, 20, 0, tzinfo=timezone.utc)


def posting_row(status="draft"):
    return (
        42, RECRUITER_ID, "Software Developer", "CareerCo", "Montreal",
        "Technology", "Develop backend services", ["Python", "Flask"],
        Decimal("65000.00"), Decimal("85000.00"), status, CREATED_AT,
    )


class RecruiterPostingTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.supabase = MagicMock()
        self.recruiter_metadata = {"role": "recruiter"}

        def get_user(_token):
            return SimpleNamespace(user=SimpleNamespace(
                id=RECRUITER_ID,
                app_metadata=self.recruiter_metadata,
                user_metadata={"role": "admin"},
            ))

        self.supabase.auth.get_user.side_effect = get_user
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer test-token"}
        self.valid = {
            "title": " Software Developer ",
            "company_name": "CareerCo",
            "location": "Montreal",
            "category": "Technology",
            "description": "Develop backend services",
            "required_skills": ["Python", "Flask"],
            "min_salary": 65000,
            "max_salary": 85000,
        }

    def post(self, data=None, headers=None):
        return self.client.post(
            "/api/recruiter/jobs",
            json=self.valid if data is None else data,
            headers=self.headers if headers is None else headers,
        )

    def test_create_requires_authentication(self):
        response = self.post(headers={})
        self.assertEqual(response.status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_non_recruiters_cannot_create_postings(self):
        self.recruiter_metadata = {"role": "job_seeker"}
        response = self.post()
        self.assertEqual(response.status_code, 403)
        self.connection.cursor.assert_not_called()

    def test_user_metadata_is_not_trusted_for_recruiter_access(self):
        self.recruiter_metadata = {}
        response = self.post({**self.valid, "role": "recruiter"})
        self.assertEqual(response.status_code, 403)
        self.connection.cursor.assert_not_called()

    def test_role_list_from_admin_metadata_is_allowed(self):
        self.recruiter_metadata = {"roles": ["job_seeker", "recruiter"]}
        self.cursor.fetchone.return_value = posting_row()
        response = self.post()
        self.assertEqual(response.status_code, 201)

    def test_create_uses_authenticated_owner_and_defaults_to_draft(self):
        self.cursor.fetchone.return_value = posting_row()
        response = self.post()
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(body["job"]["recruiter_id"], RECRUITER_ID)
        self.assertEqual(body["job"]["status"], "draft")
        self.assertEqual(body["job"]["min_salary"], 65000.0)
        self.assertEqual(body["job"]["created_at"], CREATED_AT.isoformat())
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("INSERT INTO public.jobs", sql)
        self.assertEqual(args[0], RECRUITER_ID)
        self.assertEqual(args[1], "Software Developer")
        self.assertEqual(args[-1], "draft")
        self.connection.commit.assert_called_once()
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_create_can_publish_immediately(self):
        self.cursor.fetchone.return_value = posting_row("published")
        response = self.post({**self.valid, "status": "published"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.cursor.execute.call_args.args[1][-1], "published")

    def test_reject_missing_required_or_bad_text(self):
        for data in ({}, {**self.valid, "title": " "}, {**self.valid, "description": 123},
                     {**self.valid, "company_name": "x" * 161}):
            with self.subTest(data=data):
                response = self.post(data)
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_reject_unknown_or_protected_fields(self):
        for field, value in (("recruiter_id", "spoofed"), ("id", 55), ("created_at", "tomorrow")):
            with self.subTest(field=field):
                self.assertEqual(self.post({**self.valid, field: value}).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_reject_invalid_salaries(self):
        invalid = [
            {"min_salary": -1}, {"min_salary": True}, {"max_salary": "10000"},
            {"min_salary": 90000, "max_salary": 40000}, {"min_salary": 1.234},
            {"max_salary": 1000000001},
        ]
        for changes in invalid:
            with self.subTest(changes=changes):
                response = self.post({**self.valid, **changes})
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_reject_malformed_required_skills(self):
        for skills in ("Python", [123], [""], ["x" * 81], ["X"] * 31):
            with self.subTest(skills=skills):
                self.assertEqual(self.post({**self.valid, "required_skills": skills}).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_skills_are_deduplicated(self):
        self.cursor.fetchone.return_value = posting_row()
        response = self.post({**self.valid, "required_skills": [" Python ", "python", "Flask"]})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.cursor.execute.call_args.args[1][6], ["Python", "Flask"])

    def test_create_rolls_back_on_database_failure(self):
        self.cursor.execute.side_effect = RuntimeError("database down")
        response = self.post()
        self.assertEqual(response.status_code, 500)
        self.connection.rollback.assert_called_once()
        self.connection.close.assert_called_once()

    def test_list_own_posts_only_and_paginated(self):
        self.cursor.fetchall.return_value = [posting_row()]
        response = self.client.get("/api/recruiter/jobs", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["jobs"][0]["id"], 42)
        self.assertFalse(body["pagination"]["has_more"])
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("WHERE recruiter_id = %s", sql)
        self.assertEqual(args, (RECRUITER_ID, 21, 0))

    def test_list_can_filter_by_status(self):
        self.cursor.fetchall.return_value = [posting_row("published"), posting_row("published")]
        response = self.client.get("/api/recruiter/jobs?status=published&limit=1&offset=2", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["pagination"]["has_more"])
        self.assertEqual(self.cursor.execute.call_args.args[1], (RECRUITER_ID, "published", 2, 2))

    def test_list_bad_filters_rejected_without_database(self):
        for query in ("?status=deleted", "?limit=-1", "?limit=101", "?offset=hi", "?offset=100001"):
            with self.subTest(query=query):
                response = self.client.get("/api/recruiter/jobs" + query, headers=self.headers)
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_detail_only_gets_owned_posting(self):
        self.cursor.fetchone.return_value = posting_row()
        response = self.client.get("/api/recruiter/jobs/42", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.cursor.execute.call_args.args[1], (42, RECRUITER_ID))

    def test_detail_other_owner_returns_404(self):
        self.cursor.fetchone.return_value = None
        response = self.client.get("/api/recruiter/jobs/42", headers=self.headers)
        self.assertEqual(response.status_code, 404)

    def test_update_own_posting_and_publish(self):
        self.cursor.fetchone.side_effect = [(Decimal("65000"), Decimal("85000")), posting_row("published")]
        response = self.client.patch("/api/recruiter/jobs/42", json={"status": "published"}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["job"]["status"], "published")
        self.assertEqual(self.cursor.execute.call_count, 2)
        first_sql, first_args = self.cursor.execute.call_args_list[0].args
        second_sql, second_args = self.cursor.execute.call_args_list[1].args
        self.assertIn("FOR UPDATE", first_sql)
        self.assertEqual(first_args, (42, RECRUITER_ID))
        self.assertIn("WHERE id = %s AND recruiter_id = %s", second_sql)
        self.assertEqual(second_args, ("published", 42, RECRUITER_ID))
        self.connection.commit.assert_called_once()

    def test_update_salary_partial_checks_existing_bounds(self):
        self.cursor.fetchone.return_value = (Decimal("65000"), Decimal("85000"))
        response = self.client.patch("/api/recruiter/jobs/42", json={"min_salary": 95000}, headers=self.headers)
        self.assertEqual(response.status_code, 400)
        self.connection.rollback.assert_called_once()
        self.assertEqual(self.cursor.execute.call_count, 1)

    def test_update_other_owner_returns_404(self):
        self.cursor.fetchone.return_value = None
        response = self.client.patch("/api/recruiter/jobs/42", json={"title": "New"}, headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.connection.rollback.assert_called_once()

    def test_update_rejects_protected_field_and_empty_body(self):
        for body in ({}, {"recruiter_id": RECRUITER_ID}, {"status": "Hired"}):
            with self.subTest(body=body):
                response = self.client.patch("/api/recruiter/jobs/42", json=body, headers=self.headers)
                self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_update_requires_recruiter_auth(self):
        self.recruiter_metadata = {"role": "job_seeker"}
        response = self.client.patch("/api/recruiter/jobs/42", json={"status": "published"}, headers=self.headers)
        self.assertEqual(response.status_code, 403)
        self.connection.cursor.assert_not_called()

    def test_update_rolls_back_on_db_error(self):
        self.cursor.execute.side_effect = RuntimeError("database down")
        response = self.client.patch("/api/recruiter/jobs/42", json={"title": "New"}, headers=self.headers)
        self.assertEqual(response.status_code, 500)
        self.connection.rollback.assert_called_once()
        self.connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
