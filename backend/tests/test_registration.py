import unittest
from unittest.mock import MagicMock

from src.main.app import create_app


class RegistrationApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor
        self.cursor.fetchone.return_value = ("parsa@example.com",)

        self.app = create_app(
            {
                "TESTING": True,
                "DB_CONNECTION_FACTORY": lambda: self.connection,
            }
        )
        self.client = self.app.test_client()

    def test_registration_succeeds(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "parsa@example.com",
                "password": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.connection.commit.assert_called_once()

        sql, params = self.cursor.execute.call_args.args
        self.assertIn("INSERT INTO users", sql)
        self.assertEqual(params[0], "parsa@example.com")
        self.assertNotEqual(params[1], "StrongPass123")

    def test_missing_fields_are_rejected(self):
        response = self.client.post(
            "/api/auth/register",
            json={"email": "parsa@example.com"},
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_email_is_rejected(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "StrongPass123",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_short_password_is_rejected(self):
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "parsa@example.com",
                "password": "short",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_duplicate_email_returns_conflict(self):
        duplicate_error = Exception("duplicate")
        duplicate_error.pgcode = "23505"
        self.cursor.execute.side_effect = duplicate_error

        response = self.client.post(
            "/api/auth/register",
            json={
                "email": "parsa@example.com",
                "password": "StrongPass123",
            },
        )

        self.assertEqual(response.status_code, 409)
        self.connection.rollback.assert_called_once()


if __name__ == "__main__":
    unittest.main()
