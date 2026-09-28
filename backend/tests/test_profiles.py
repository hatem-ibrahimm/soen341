import unittest
from unittest.mock import MagicMock

from src.main.app import create_app


class ProfileApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor

        self.cursor.fetchone.return_value = (
            1,
            "Jane",
            "Doe",
            "jane.doe@example.com",
            "514-555-1234",
            "Montreal, QC",
            "Computer Engineering student",
            "2026-09-27",
        )

        self.app = create_app(
            {
                "TESTING": True,
                "DB_CONNECTION_FACTORY": lambda: self.connection,
            }
        )

        self.client = self.app.test_client()

    def test_profile_creation_succeeds(self):
        response = self.client.post(
            "/api/profiles",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.doe@example.com",
                "phone_number": "514-555-1234",
                "location": "Montreal, QC",
                "bio": "Computer Engineering student",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.connection.commit.assert_called_once()

        sql, params = self.cursor.execute.call_args.args

        self.assertIn("INSERT INTO profiles", sql)
        self.assertEqual(params[0], "Jane")
        self.assertEqual(params[1], "Doe")
        self.assertEqual(params[2], "jane.doe@example.com")
        self.assertEqual(params[3], "514-555-1234")
        self.assertEqual(params[4], "Montreal, QC")
        self.assertEqual(params[5], "Computer Engineering student")

    def test_missing_fields_are_rejected(self):
        response = self.client.post(
            "/api/profiles",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_invalid_json_is_rejected(self):
        response = self.client.post(
            "/api/profiles",
            data="not valid json",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.connection.cursor.assert_not_called()

    def test_get_profile_succeeds(self):
        response = self.client.get("/api/profiles/1")

        self.assertEqual(response.status_code, 200)

        data = response.get_json()

        self.assertEqual(data["profile"]["id"], 1)
        self.assertEqual(data["profile"]["first_name"], "Jane")
        self.assertEqual(data["profile"]["last_name"], "Doe")
        self.assertEqual(data["profile"]["email"], "jane.doe@example.com")

        sql, params = self.cursor.execute.call_args.args
        self.assertIn("SELECT id, first_name, last_name, email", sql)
        self.assertEqual(params[0], 1)

    def test_get_profile_not_found(self):
        self.cursor.fetchone.return_value = None

        response = self.client.get("/api/profiles/999")

        self.assertEqual(response.status_code, 404)

        data = response.get_json()
        self.assertEqual(data["error"], "Profile not found.")
    
    def test_update_profile_succeeds(self):
        response = self.client.put(
            "/api/profiles/1",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.doe@example.com",
                "phone_number": "514-555-1234",
                "location": "Montreal, QC",
                "bio": "Computer Engineering student",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.connection.commit.assert_called_once()

        data = response.get_json()

        self.assertEqual(data["profile"]["id"], 1)
        self.assertEqual(data["profile"]["first_name"], "Jane")
        self.assertEqual(data["profile"]["last_name"], "Doe")
        self.assertEqual(data["profile"]["email"], "jane.doe@example.com")
        self.assertEqual(data["profile"]["phone_number"], "514-555-1234")
        self.assertEqual(data["profile"]["location"], "Montreal, QC")
        self.assertEqual(
            data["profile"]["bio"],
            "Computer Engineering student",
        )

        sql, params = self.cursor.execute.call_args.args

        self.assertIn("UPDATE profiles", sql)
        self.assertEqual(params[0], "Jane")
        self.assertEqual(params[1], "Doe")
        self.assertEqual(params[2], "jane.doe@example.com")
        self.assertEqual(params[6], 1)

    def test_update_profile_not_found(self):
        self.cursor.fetchone.return_value = None

        response = self.client.put(
            "/api/profiles/999",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.doe@example.com",
                "phone_number": "514-555-1234",
                "location": "Montreal, QC",
                "bio": "Computer Engineering student",
            },
        )

        self.assertEqual(response.status_code, 404)

        data = response.get_json()
        self.assertEqual(data["error"], "Profile not found.")

        self.connection.rollback.assert_called_once()

if __name__ == "__main__":
    unittest.main()