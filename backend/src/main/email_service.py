
import os
import smtplib
from email.message import EmailMessage


def send_email(to_email, subject, message):
    """Send an email using SMTP settings from environment variables."""

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    # Email is optional. Skip sending if it is not configured.
    if not all([smtp_host, smtp_user, smtp_password]):
        return False

    email = EmailMessage()
    email["From"] = smtp_user
    email["To"] = to_email
    email["Subject"] = subject
    email.set_content(message)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(email)

        return True

    except (smtplib.SMTPException, OSError):
        return False