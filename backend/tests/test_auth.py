import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


def auth_response(
    email="parsa@example.com",
    user_id="11111111-1111-1111-1111-111111111111",
    with_session=True,
    app_metadata=None,
    user_metadata=None,
):
    user = SimpleNamespace(
        id=user_id,
        email=email,
        app_metadata=app_metadata or {},
        user_metadata=user_metadata or {},
    )
    session = None
    if with_session:
        session = SimpleNamespace(
            access_token="access-token",
            refresh_token="refresh-token",
        )
    return SimpleNamespace(user=user, session=session)


class AuthApiTests(unittest.TestCase):
    def setUp(self):
        self.supabase = MagicMock()
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.cursor.fetchone.return_value = None  # Job seeker by default.
        self.app = create_app(
            {
                "TESTING": True,
                "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
                "DB_CONNECTION_FACTORY": lambda: self.connection,
            }
        )
        self.client = self.app.test_client()

    def test_registration_success(self):
        self.supabase.auth.sign_up.return_value = auth_response()

        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "Parsa@example.com",
                "password": "StrongPass123",
                "first_name": "Parsa",
                "last_name": "Dalirirad",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.supabase.auth.sign_up.assert_called_once_with(
            {
                "email": "parsa@example.com",
                "password": "StrongPass123",
                "options": {
                    "data": {
                        "first_name": "Parsa",
                        "last_name": "Dalirirad",
                        "role": "job_seeker",
                    }
                },
            }
        )
        self.assertEqual(response.get_json()["user"]["email"], "parsa@example.com")

    def test_recruiter_registration_uses_signup_metadata_without_admin_access(self):
        self.supabase.auth.sign_up.return_value = auth_response()
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "recruiter@example.com",
                "password": "StrongPass123",
                "first_name": "Rae",
                "last_name": "Recruiter",
                "role": "recruiter",
                "company_name": "Northwind Labs",
            },
        )

        self.assertEqual(response.status_code, 201)
        signup_payload = self.supabase.auth.sign_up.call_args.args[0]
        self.assertEqual(
            signup_payload["options"]["data"]["company_name"],
            "Northwind Labs",
        )
        self.assertEqual(signup_payload["options"]["data"]["role"], "recruiter")
        self.supabase.auth.admin.update_user_by_id.assert_not_called()
        self.assertEqual(response.get_json()["user"]["role"], "recruiter")

    def test_recruiter_registration_allows_blank_company_name(self):
        self.supabase.auth.sign_up.return_value = auth_response()

        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "recruiter@example.com",
                "password": "StrongPass123",
                "role": "recruiter",
                "company_name": "   ",
            },
        )

        self.assertEqual(response.status_code, 201)

        data = self.supabase.auth.sign_up.call_args.args[0]["options"]["data"]
        self.assertEqual(data["company_name"], "")

    def test_registration_rejects_unknown_role(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "user@example.com",
                "password": "StrongPass123",
                "role": "admin",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.supabase.auth.sign_up.assert_not_called()

    def test_registration_with_email_confirmation(self):
        self.supabase.auth.sign_up.return_value = auth_response(with_session=False)

        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "parsa@example.com",
                "password": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json()["email_confirmation_required"])

    def test_invalid_registration_email(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "bad-email",
                "password": "StrongPass123",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_short_registration_password(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "parsa@example.com",
                "password": "short",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_registration(self):
        self.supabase.auth.sign_up.side_effect = Exception("User already registered")

        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "parsa@example.com",
                "password": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 409)

    def test_login_success(self):
        self.supabase.auth.sign_in_with_password.return_value = auth_response(
            app_metadata={"role": "recruiter"},
            user_metadata={"company_name": "Northwind Labs"},
        )

        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "parsa@example.com",
                "password": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["session"]["access_token"],
            "access-token",
        )
        self.assertEqual(response.get_json()["user"]["role"], "recruiter")

    def test_login_invalid_credentials(self):
        self.supabase.auth.sign_in_with_password.side_effect = Exception(
            "Invalid login credentials"
        )

        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "parsa@example.com",
                "password": "wrong-password",
            },
        )

        self.assertEqual(response.status_code, 401)

    def test_me_requires_bearer_token(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_me_validates_token_with_supabase(self):
        self.supabase.auth.get_user.return_value = SimpleNamespace(
            user=SimpleNamespace(
                id="11111111-1111-1111-1111-111111111111",
                email="parsa@example.com",
            )
        )

        response = self.client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer access-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.supabase.auth.get_user.assert_called_once_with("access-token")
        self.assertEqual(response.get_json()["user"]["email"], "parsa@example.com")
        self.assertEqual(response.get_json()["user"]["role"], "job_seeker")

    def test_recruiter_registration_passes_metadata_to_supabase(self):
        self.supabase.auth.sign_up.return_value = auth_response()
        response = self.client.post("/api/auth/register", json={
            "email": "recruiter@example.test", "password": "StrongPass123",
            "first_name": "Alex", "last_name": "Smith",
            "role": "recruiter", "company_name": " CareerCo ",
        })
        self.assertEqual(response.status_code, 201)
        data = self.supabase.auth.sign_up.call_args.args[0]["options"]["data"]
        self.assertEqual(data, {
            "first_name": "Alex", "last_name": "Smith",
            "role": "recruiter", "company_name": "CareerCo",
        })

    def test_recruiter_registration_optional_company_name(self):
        self.supabase.auth.sign_up.return_value = auth_response()
        response = self.client.post("/api/auth/register", json={
            "email": "recruiter@example.test", "password": "StrongPass123",
            "role": "recruiter",
        })
        self.assertEqual(response.status_code, 201)
        data = self.supabase.auth.sign_up.call_args.args[0]["options"]["data"]
        self.assertEqual(data["company_name"], "")

    def test_invalid_role_is_rejected_before_signup(self):
        for role in ("admin", "RECRUITER", "", 15, None, ["recruiter"]):
            with self.subTest(role=role):
                response = self.client.post("/api/auth/register", json={
                    "email": "some@example.test", "password": "StrongPass123",
                    "role": role,
                })
                self.assertEqual(response.status_code, 400)
        self.supabase.auth.sign_up.assert_not_called()

    def test_invalid_company_is_rejected_before_signup(self):
        for company in (123, ["company"], "C" * 161):
            with self.subTest(company=company):
                response = self.client.post("/api/auth/register", json={
                    "email": "some@example.test", "password": "StrongPass123",
                    "role": "recruiter", "company_name": company,
                })
                self.assertEqual(response.status_code, 400)
        self.supabase.auth.sign_up.assert_not_called()

    def test_company_name_not_allowed_for_job_seeker(self):
        response = self.client.post("/api/auth/register", json={
            "email": "some@example.test", "password": "StrongPass123",
            "role": "job_seeker", "company_name": "Unexpected Co",
        })
        self.assertEqual(response.status_code, 400)
        self.supabase.auth.sign_up.assert_not_called()

    def test_login_returns_recruiter_role_from_db_membership(self):
        self.supabase.auth.sign_in_with_password.return_value = auth_response()
        self.cursor.fetchone.return_value = (1,)
        response = self.client.post("/api/auth/login", json={
            "email": "parsa@example.com", "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "recruiter")
        sql, args = self.cursor.execute.call_args.args
        self.assertIn("public.recruiters", sql)
        self.assertEqual(args, ("11111111-1111-1111-1111-111111111111",))

    def test_me_returns_recruiter_role_from_db_membership(self):
        self.supabase.auth.get_user.return_value = auth_response()
        self.cursor.fetchone.return_value = (1,)
        response = self.client.get("/api/auth/me", headers={
            "Authorization": "Bearer access-token",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "recruiter")

    def test_login_role_cannot_be_forged_by_payload(self):
        self.supabase.auth.sign_in_with_password.return_value = auth_response()
        response = self.client.post("/api/auth/login", json={
            "email": "parsa@example.com", "password": "StrongPass123",
            "role": "recruiter",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "job_seeker")

    def test_editable_user_metadata_role_alone_does_not_grant_access(self):
        user_response = auth_response()
        user_response.user.user_metadata = {"role": "recruiter"}
        self.supabase.auth.get_user.return_value = user_response
        response = self.client.get("/api/auth/me", headers={
            "Authorization": "Bearer access-token",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "job_seeker")

    def test_login_trusted_app_metadata_recognized_without_database_query(self):
        response = auth_response()
        response.user.app_metadata = {"role": "recruiter"}
        self.supabase.auth.sign_in_with_password.return_value = response
        actual = self.client.post("/api/auth/login", json={
            "email": "parsa@example.com", "password": "StrongPass123",
        })
        self.assertEqual(actual.status_code, 200)
        self.assertEqual(actual.get_json()["user"]["role"], "recruiter")
        self.connection.cursor.assert_not_called()

    def test_login_database_failure_returns_503_not_false_role(self):
        self.supabase.auth.sign_in_with_password.return_value = auth_response()
        self.cursor.execute.side_effect = RuntimeError("database offline")
        response = self.client.post("/api/auth/login", json={
            "email": "parsa@example.com", "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("session", response.get_json())

    def test_me_database_failure_returns_503(self):
        self.supabase.auth.get_user.return_value = auth_response()
        self.cursor.execute.side_effect = RuntimeError("database offline")
        response = self.client.get("/api/auth/me", headers={
            "Authorization": "Bearer access-token",
        })
        self.assertEqual(response.status_code, 503)


if __name__ == "__main__":
    unittest.main()
