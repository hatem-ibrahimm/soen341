
import unittest
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.main.app import create_app


class ResumeApiTests(unittest.TestCase):

    def setUp(self):
        self.profile_id = "550e8400-e29b-41d4-a716-446655440000"

        self.connection = MagicMock()
        self.cursor = MagicMock()
        self.connection.cursor.return_value = self.cursor

        self.resume_row = (
            "resume-123",
            self.profile_id,
            "resume.pdf",
            f"{self.profile_id}/resume123.pdf",
            "application/pdf",
            8,
            "2026-10-25T10:00:00+00:00",
        )

        self.supabase = MagicMock()
        self.supabase.auth.get_user.return_value = SimpleNamespace(
            user=SimpleNamespace(
                id=self.profile_id,
                email="jane.doe@example.com",
            )
        )

        self.storage = self.supabase.storage.from_.return_value
        self.storage.create_signed_url.return_value = {
            "signedURL": "https://example.com/temporary-resume-link"
        }

        self.app = create_app({
            "TESTING": True,
            "DB_CONNECTION_FACTORY": lambda: self.connection,
            "SUPABASE_CLIENT_FACTORY": lambda: self.supabase,
        })

        self.client = self.app.test_client()
        self.headers = {"Authorization": "Bearer test-token"}

        self.url = f"/api/profiles/{self.profile_id}/resume"

    def test_upload_resume_succeeds(self):
        self.cursor.fetchone.side_effect = [None, self.resume_row]

        response = self.client.post(
            self.url,
            headers=self.headers,
            data={
                "resume": (
                    BytesIO(b"PDF data"),
                    "resume.pdf",
                )
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.get_json()["message"],
            "Resume uploaded successfully.",
        )
        self.storage.upload.assert_called_once()
        self.connection.commit.assert_called_once()

    def test_invalid_resume_format_is_rejected(self):
        response = self.client.post(
            self.url,
            headers=self.headers,
            data={
                "resume": (
                    BytesIO(b"Not a supported resume"),
                    "resume.txt",
                )
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only PDF and DOC", response.get_json()["error"])
        self.cursor.execute.assert_not_called()
        self.storage.upload.assert_not_called()

    def test_get_resume_succeeds(self):
        self.cursor.fetchone.return_value = self.resume_row

        response = self.client.get(
            self.url,
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        data = response.get_json()["resume"]
        self.assertEqual(data["file_name"], "resume.pdf")
        self.assertIn("download_url", data)
        self.storage.create_signed_url.assert_called_once()

    def test_replace_resume_succeeds(self):
        updated_row = (
            "resume-123",
            self.profile_id,
            "updated.pdf",
            f"{self.profile_id}/updated123.pdf",
            "application/pdf",
            10,
            "2026-10-25T11:00:00+00:00",
        )
        self.cursor.fetchone.side_effect = [self.resume_row, updated_row]

        response = self.client.put(
            self.url,
            headers=self.headers,
            data={
                "resume": (
                    BytesIO(b"Updated PDF"),
                    "updated.pdf",
                )
            },
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["message"],
            "Resume replaced successfully.",
        )
        self.storage.upload.assert_called_once()
        self.storage.remove.assert_called_once()
        self.connection.commit.assert_called_once()

    def test_delete_resume_succeeds(self):
        self.cursor.fetchone.return_value = (
            f"{self.profile_id}/resume123.pdf",
        )

        response = self.client.delete(
            self.url,
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["message"],
            "Resume deleted successfully.",
        )
        self.storage.remove.assert_called_once()
        self.connection.commit.assert_called_once()

    def test_resume_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json()["error"],
            "Authentication required.",
        )
        self.connection.cursor.assert_not_called()


if __name__ == "__main__":
    unittest.main()