
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


class ProfileApiTests(unittest.TestCase):

    def setUp(self):
        # Use a valid UUID because profile IDs match Supabase user IDs.
        self.profile_id = "550e8400-e29b-41d4-a716-446655440000"

        # Mock the database connection and cursor.
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor

        # A profile row must match the order in PROFILE_COLUMNS.
        self.profile_row = (
            self.profile_id,
            "Jane",
            "Doe",
            "Computer Engineering Student",
            "jane.doe@example.com",
            "514-555-1234",
            "Montreal, QC",
            "Computer Engineering student",
            "2026-10-23T10:00:00+00:00",
            "2026-10-23T10:00:00+00:00",
        )
        self.cursor.fetchone.return_value = self.profile_row

        # Mock Supabase authentication.
        self.supabase = MagicMock()
        self.supabase.auth.get_user.return_value = SimpleNamespace(
            user=SimpleNamespace(
                id=self.profile_id,
                email="jane.doe@example.com",
            )
        )

        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })

        self.client = self.app.test_client()

        self.headers = {
            "Authorization": "Bearer test-token"
        }

        self.profile_data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "title": "Computer Engineering Student",
            "email": "jane.doe@example.com",
            "phone_number": "514-555-1234",
            "location": "Montreal, QC",
            "bio": "Computer Engineering student",
        }

    def test_get_profile_succeeds(self):
        response = self.client.get(
            f"/api/profiles/{self.profile_id}",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()

        self.assertIn("profile", data)
        self.assertEqual(data["profile"]["id"], self.profile_id)
        self.assertEqual(data["profile"]["first_name"], "Jane")
        self.cursor.execute.assert_called_once()

    def test_get_profile_not_found(self):
        self.cursor.fetchone.return_value = None

        response = self.client.get(
            f"/api/profiles/{self.profile_id}",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.get_json()["error"],
            "Profile not found.",
        )

    def test_update_profile_succeeds(self):
        response = self.client.put(
            f"/api/profiles/{self.profile_id}",
            headers=self.headers,
            json=self.profile_data,
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()

        self.assertEqual(
            data["message"],
            "Profile updated successfully.",
        )
        self.assertEqual(data["profile"]["first_name"], "Jane")
        self.connection.commit.assert_called_once()

    def test_update_profile_not_found(self):
        self.cursor.fetchone.return_value = None

        response = self.client.put(
            f"/api/profiles/{self.profile_id}",
            headers=self.headers,
            json=self.profile_data,
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.get_json()["error"],
            "Profile not found.",
        )
        self.connection.rollback.assert_called_once()

    def test_missing_fields_are_rejected(self):
        response = self.client.put(
            f"/api/profiles/{self.profile_id}",
            headers=self.headers,
            json={
                "first_name": "Jane",
                "last_name": "Doe",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.get_json())
        self.cursor.execute.assert_not_called()

    def test_invalid_json_is_rejected(self):
        response = self.client.put(
            f"/api/profiles/{self.profile_id}",
            headers=self.headers,
            data="not valid json",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json()["error"],
            "Request body must be valid JSON.",
        )
        self.cursor.execute.assert_not_called()

    def test_authentication_is_required(self):
        response = self.client.get(
            f"/api/profiles/{self.profile_id}"
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json()["error"],
            "Authentication required.",
        )
        self.connection.cursor.assert_not_called()


if __name__ == "__main__":
    unittest.main()
