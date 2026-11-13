
import unittest
from unittest.mock import MagicMock, patch

from src.main.email_service import send_email


class EmailServiceTests(unittest.TestCase):

    @patch("src.main.email_service.smtplib.SMTP")
    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.example.com",
        "SMTP_PORT": "587",
        "SMTP_USER": "test@example.com",
        "SMTP_PASSWORD": "test-password",
    })
    def test_email_sent_successfully(self, mock_smtp):
        server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = server

        result = send_email(
            "applicant@example.com",
            "Application Status Updated",
            "Your application status has changed to Interview.",
        )

        self.assertTrue(result)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with(
            "test@example.com",
            "test-password",
        )
        server.send_message.assert_called_once()

    @patch.dict("os.environ", {
        "SMTP_HOST": "",
        "SMTP_USER": "",
        "SMTP_PASSWORD": "",
    })
    def test_email_skipped_when_not_configured(self):
        result = send_email(
            "applicant@example.com",
            "Test",
            "Test message",
        )

        self.assertFalse(result)

    @patch("src.main.email_service.smtplib.SMTP")
    @patch.dict("os.environ", {
        "SMTP_HOST": "smtp.example.com",
        "SMTP_PORT": "587",
        "SMTP_USER": "test@example.com",
        "SMTP_PASSWORD": "test-password",
    })
    def test_email_failure_returns_false(self, mock_smtp):
        mock_smtp.side_effect = OSError("Connection failed")

        result = send_email(
            "applicant@example.com",
            "Test",
            "Test message",
        )

        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
