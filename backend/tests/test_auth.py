import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


def auth_response(
    email="parsa@example.com",
    user_id="11111111-1111-1111-1111-111111111111",
    with_session=True,
):
    user = SimpleNamespace(id=user_id, email=email)
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
        self.app = create_app(
            {
                "TESTING": True,
                "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
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
            },
        )

        self.assertEqual(response.status_code, 201)
        self.supabase.auth.sign_up.assert_called_once_with(
            {
                "email": "parsa@example.com",
                "password": "StrongPass123",
                "options": {
                    "data": {
                        "first_name": "",
                        "last_name": "",
                    }
                },
            }
        )
        self.assertEqual(response.get_json()["user"]["email"], "parsa@example.com")

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
        self.supabase.auth.sign_in_with_password.return_value = auth_response()

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


if __name__ == "__main__":
    unittest.main()
