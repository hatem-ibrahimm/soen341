import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


PROFILE_ID = "11111111-1111-1111-1111-111111111111"
PROFILE_ROW = (
	PROFILE_ID,
	"Parsa",
	"Dalirirad",
	"Software Engineer",
	"parsa@example.com",
	"555-0100",
	"Montreal",
	"A profile bio",
	"2026-01-01T00:00:00+00:00",
	"2026-01-02T00:00:00+00:00",
)


class ProfileApiTests(unittest.TestCase):
	def setUp(self):
		self.supabase = MagicMock()
		self.supabase.auth.get_user.return_value = SimpleNamespace(
			user=SimpleNamespace(id=PROFILE_ID, email="parsa@example.com")
		)
		self.cursor = MagicMock()
		self.connection = MagicMock()
		self.connection.cursor.return_value = self.cursor
		self.app = create_app(
			{
				"TESTING": True,
				"SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
				"DB_CONNECTION_FACTORY": lambda: self.connection,
			}
		)
		self.client = self.app.test_client()
		self.headers = {"Authorization": "Bearer access-token"}

	def test_get_profile_returns_database_row(self):
		self.cursor.fetchone.return_value = PROFILE_ROW

		response = self.client.get(
			f"/api/profiles/{PROFILE_ID}", headers=self.headers
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.get_json()["profile"]["title"], "Software Engineer")
		self.cursor.execute.assert_called_once()
		self.assertIn("updated_at", self.cursor.execute.call_args.args[0])
		self.assertEqual(self.cursor.execute.call_args.args[1], (PROFILE_ID,))
		self.connection.close.assert_called_once()

	def test_update_profile_writes_profile_fields(self):
		self.cursor.fetchone.return_value = PROFILE_ROW

		response = self.client.put(
			f"/api/profiles/{PROFILE_ID}",
			headers=self.headers,
			json={
				"first_name": "Parsa",
				"last_name": "Dalirirad",
				"title": "Software Engineer",
				"email": "parsa@example.com",
				"phone_number": "555-0100",
				"location": "Montreal",
				"bio": "A profile bio",
			},
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.get_json()["profile"]["id"], PROFILE_ID)
		self.assertIn("updated_at", self.cursor.execute.call_args.args[0])
		self.assertEqual(self.cursor.execute.call_args.args[1][-1], PROFILE_ID)
		self.connection.commit.assert_called_once()

	def test_profile_request_requires_authentication(self):
		response = self.client.get(f"/api/profiles/{PROFILE_ID}")

		self.assertEqual(response.status_code, 401)
		self.connection.cursor.assert_not_called()


if __name__ == "__main__":
	unittest.main()