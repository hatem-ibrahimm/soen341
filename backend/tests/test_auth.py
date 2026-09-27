import unittest
from unittest.mock import MagicMock
import jwt
from werkzeug.security import generate_password_hash

from src.main.app import create_app


class AuthApiTests(unittest.TestCase):
    def make_client(self, row=None):
        connection = MagicMock()
        cursor = MagicMock()
        connection.cursor.return_value = cursor
        cursor.fetchone.return_value = row
        app = create_app({
            "TESTING": True,
            "JWT_SECRET": "test-secret",
            "DB_CONNECTION_FACTORY": lambda: connection,
        })
        return app.test_client(), connection, cursor

    def test_registration_success(self):
        client, connection, cursor = self.make_client(("parsa@example.com",))
        response = client.post("/api/auth/register", json={
            "email": "Parsa@example.com",
            "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 201)
        _, params = cursor.execute.call_args.args
        self.assertEqual(params[0], "parsa@example.com")
        self.assertNotEqual(params[1], "StrongPass123")
        connection.commit.assert_called_once()

    def test_invalid_registration_email(self):
        client, _, _ = self.make_client()
        response = client.post("/api/auth/register", json={
            "email": "bad-email",
            "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 400)

    def test_duplicate_registration(self):
        client, connection, cursor = self.make_client()
        err = Exception("duplicate")
        err.pgcode = "23505"
        cursor.execute.side_effect = err
        response = client.post("/api/auth/register", json={
            "email": "parsa@example.com",
            "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 409)
        connection.rollback.assert_called_once()

    def test_login_success(self):
        password_hash = generate_password_hash("StrongPass123")
        client, _, _ = self.make_client(("parsa@example.com", password_hash))
        response = client.post("/api/auth/login", json={
            "email": "parsa@example.com",
            "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.get_json())

    def test_login_wrong_password(self):
        password_hash = generate_password_hash("StrongPass123")
        client, _, _ = self.make_client(("parsa@example.com", password_hash))
        response = client.post("/api/auth/login", json={
            "email": "parsa@example.com",
            "password": "wrong-password",
        })
        self.assertEqual(response.status_code, 401)

    def test_login_unknown_user(self):
        client, _, _ = self.make_client(None)
        response = client.post("/api/auth/login", json={
            "email": "missing@example.com",
            "password": "StrongPass123",
        })
        self.assertEqual(response.status_code, 401)

    def test_me_requires_token(self):
        client, _, _ = self.make_client()
        response = client.get("/api/auth/me")
        self.assertEqual(response.status_code, 401)

    def test_me_accepts_valid_token(self):
        client, _, _ = self.make_client()
        token = jwt.encode({"sub": "parsa@example.com"}, "test-secret", algorithm="HS256")
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["email"], "parsa@example.com")


if __name__ == "__main__":
    unittest.main()
