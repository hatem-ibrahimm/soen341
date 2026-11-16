

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


RECRUITER_ID = "550e8400-e29b-41d4-a716-446655440000"
APPLICANT_ID = "11111111-1111-4111-8111-111111111111"
APPLICATION_ID = "22222222-2222-4222-8222-222222222222"
RESUME_ID = "33333333-3333-4333-8333-333333333333"
SUBMITTED_AT = datetime(2026, 11, 10, 14, 30, tzinfo=timezone.utc)


def application_row(*, status="Applied", resume=True, profile=True, details=False):
    row = (
        APPLICATION_ID, APPLICANT_ID, 42, RESUME_ID if resume else None,
        status, SUBMITTED_AT,
        "Alex" if profile else None,
        "Candidate" if profile else None,
        "alex@example.test" if profile else None,
        "resume.pdf" if resume else None,
    )
    return row + (
        "Please consider my application.",
        "Software Engineer",
        "514-555-0100",
        "Montreal",
        "Experienced software engineer.",
    ) if details else row


class RecruiterApplicantsTests(unittest.TestCase):
    def setUp(self):
        self.cursor = MagicMock()
        self.connection = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.supabase = MagicMock()
        self.metadata = {"role": "recruiter"}

        def get_user(_token):
            return SimpleNamespace(user=SimpleNamespace(
                id=RECRUITER_ID,
                app_metadata=self.metadata,
                user_metadata={"role": "recruiter"},
            ))

        self.supabase.auth.get_user.side_effect = get_user
        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })
        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer mock-token"}

    def list(self, suffix="", headers=None):
        return self.client.get(
            "/api/recruiter/jobs/42/applications" + suffix,
            headers=self.headers if headers is None else headers,
        )

    def detail(self, application_id=APPLICATION_ID, headers=None):
        return self.client.get(
            "/api/recruiter/applications/" + application_id,
            headers=self.headers if headers is None else headers,
        )

    def resume(self, application_id=APPLICATION_ID, headers=None):
        return self.client.get(
            f"/api/recruiter/applications/{application_id}/resume",
            headers=self.headers if headers is None else headers,
        )

    def test_list_requires_authentication(self):
        self.assertEqual(self.list(headers={}).status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_detail_requires_authentication(self):
        self.assertEqual(self.detail(headers={}).status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_resume_requires_authentication(self):
        self.assertEqual(self.resume(headers={}).status_code, 401)
        self.connection.cursor.assert_not_called()

    def test_non_recruiter_is_rejected(self):
        self.metadata = {"role": "job_seeker"}
        self.cursor.fetchone.return_value = None
        self.assertEqual(self.list().status_code, 403)
        self.assertEqual(self.detail().status_code, 403)
        self.assertEqual(self.cursor.execute.call_count, 2)

    def test_user_metadata_cannot_grant_recruiter_role(self):
        self.metadata = {}
        self.cursor.fetchone.return_value = None
        self.assertEqual(self.list().status_code, 403)
        self.assertIn("public.recruiters", self.cursor.execute.call_args.args[0])

    def test_admin_metadata_roles_list_is_accepted(self):
        self.metadata = {"roles": ["job_seeker", "recruiter"]}
        self.cursor.fetchone.return_value = (42,)
        self.cursor.fetchall.return_value = []
        self.assertEqual(self.list().status_code, 200)

    def test_invalid_job_id_is_rejected(self):
        response = self.client.get(
            "/api/recruiter/jobs/0/applications", headers=self.headers
        )
        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_job_id_outside_postgres_bigint_range_is_rejected(self):
        response = self.client.get(
            "/api/recruiter/jobs/9223372036854775808/applications",
            headers=self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_other_recruiters_job_returns_404_without_applicant_query(self):
        self.cursor.fetchone.return_value = None
        response = self.list()
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.cursor.execute.call_count, 1)
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("recruiter_id = %s", sql)
        self.assertEqual(args, (42, RECRUITER_ID))
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_list_returns_owned_applicants_and_pagination(self):
        self.cursor.fetchone.return_value = (42,)
        self.cursor.fetchall.return_value = [application_row()]
        response = self.list()
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(len(body["applications"]), 1)
        application = body["applications"][0]
        self.assertEqual(application["job_id"], 42)
        self.assertEqual(application["status"], "Applied")
        self.assertEqual(application["applicant"]["email"], "alex@example.test")
        self.assertEqual(application["resume"]["file_name"], "resume.pdf")
        self.assertNotIn("storage_path", str(body))
        self.assertNotIn("cover_letter", application)
        self.assertFalse(body["pagination"]["has_more"])
        self.assertEqual(body["pagination"]["limit"], 20)
        self.assertEqual(body["pagination"]["offset"], 0)
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("JOIN public.jobs AS j", sql)
        self.assertIn("j.recruiter_id = %s", sql)
        self.assertEqual(args, (42, RECRUITER_ID, 21, 0))
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_list_status_filter_and_has_more(self):
        self.cursor.fetchone.return_value = (42,)
        self.cursor.fetchall.return_value = [
            application_row(status="Interview"), application_row(status="Interview"),
        ]
        response = self.list("?status=Interview&limit=1&offset=2")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["pagination"]["has_more"])
        self.assertEqual(len(response.get_json()["applications"]), 1)
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("a.status = %s", sql)
        self.assertEqual(args, (42, RECRUITER_ID, "Interview", 2, 2))

    def test_all_five_statuses_are_supported(self):
        for status in ("Applied", "Under Review", "Interview", "Offered", "Rejected"):
            with self.subTest(status=status):
                self.cursor.fetchone.return_value = (42,)
                self.cursor.fetchall.return_value = []
                response = self.list("?status=" + status.replace(" ", "%20"))
                self.assertEqual(response.status_code, 200)

    def test_bad_filters_do_not_access_database(self):
        for suffix in (
            "?status=Pending", "?limit=0", "?limit=101", "?limit=-1",
            "?limit=1.5", "?limit=%20", "?offset=-1", "?offset=100001",
            "?offset=oops", "?offset=%E0%B9%91",
        ):
            with self.subTest(suffix=suffix):
                self.assertEqual(self.list(suffix).status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_empty_owned_job_returns_success(self):
        self.cursor.fetchone.return_value = (42,)
        self.cursor.fetchall.return_value = []
        response = self.list()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["applications"], [])

    def test_missing_profile_and_resume_are_handled(self):
        self.cursor.fetchone.return_value = (42,)
        self.cursor.fetchall.return_value = [application_row(profile=False, resume=False)]
        response = self.list()
        self.assertEqual(response.status_code, 200)
        application = response.get_json()["applications"][0]
        self.assertIsNone(application["resume"])
        self.assertIsNone(application["applicant"]["first_name"])

    def test_detail_rejects_malformed_id(self):
        response = self.detail("bad-id")
        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_detail_returns_authorized_application(self):
        self.cursor.fetchone.return_value = application_row(details=True)
        response = self.detail()
        self.assertEqual(response.status_code, 200)
        application = response.get_json()["application"]
        self.assertEqual(application["cover_letter"], "Please consider my application.")
        self.assertEqual(application["submitted_at"], SUBMITTED_AT.isoformat())
        self.assertEqual(application["applicant"]["title"], "Software Engineer")
        self.assertEqual(application["applicant"]["location"], "Montreal")
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("j.recruiter_id = %s", sql)
        self.assertIn("a.id = %s", sql)
        self.assertEqual(args, (APPLICATION_ID, RECRUITER_ID))
        self.connection.close.assert_called_once()

    def test_details_of_another_recruiters_application_are_hidden(self):
        self.cursor.fetchone.return_value = None
        response = self.detail()
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.cursor.execute.call_args.args[1], (APPLICATION_ID, RECRUITER_ID))

    def test_resume_download_is_signed_only_for_owned_application(self):
        self.cursor.fetchone.return_value = ("resume.pdf", "applicant/resume.pdf")
        self.supabase.storage.from_.return_value.create_signed_url.return_value = {
            "signedURL": "https://example.test/temporary-resume"
        }

        response = self.resume()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["resume"], {
            "file_name": "resume.pdf",
            "download_url": "https://example.test/temporary-resume",
        })
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("j.recruiter_id = %s", sql)
        self.assertEqual(params, (APPLICATION_ID, RECRUITER_ID))
        self.supabase.storage.from_.return_value.create_signed_url.assert_called_once_with(
            "applicant/resume.pdf",
            self.app.config["RESUME_SIGNED_URL_SECONDS"],
        )

    def test_resume_of_another_recruiters_application_is_hidden(self):
        self.cursor.fetchone.return_value = None

        response = self.resume()

        self.assertEqual(response.status_code, 404)
        self.supabase.storage.from_.return_value.create_signed_url.assert_not_called()

    def test_list_database_failure_is_safe_and_closes_connection(self):
        self.cursor.execute.side_effect = RuntimeError("Database unavailable")
        response = self.list()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json()["error"], "Unable to retrieve job applications.")
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_detail_database_failure_is_safe_and_closes_connection(self):
        self.cursor.execute.side_effect = RuntimeError("Database unavailable")
        response = self.detail()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json()["error"], "Unable to retrieve application.")
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()

    def test_detail_does_not_create_or_modify_applications(self):
        self.cursor.fetchone.return_value = application_row(details=True)
        response = self.detail()
        self.assertEqual(response.status_code, 200)
        sql, _ = self.cursor.execute.call_args.args
        self.assertTrue(sql.lstrip().startswith("SELECT"))
        self.connection.commit.assert_not_called()


    def test_database_recruiter_row_grants_applicant_listing(self):
        self.metadata = {}
        self.cursor.fetchone.side_effect = [(1,), (42,)]
        self.cursor.fetchall.return_value = [application_row()]
        response = self.list()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["applications"]), 1)
        self.assertIn("public.recruiters", self.cursor.execute.call_args_list[0].args[0])
        self.assertIn("public.jobs", self.cursor.execute.call_args_list[1].args[0])

    def test_recruiter_role_lookup_failure_returns_503(self):
        self.metadata = {}
        self.cursor.execute.side_effect = RuntimeError("database offline")
        response = self.detail()
        self.assertEqual(response.status_code, 503)
        self.cursor.close.assert_called_once()
        self.connection.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
