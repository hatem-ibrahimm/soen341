import json
from unittest.mock import patch

import pytest

from src.main.ai_resume_service import (
    generate_resume_feedback,
    redact_contact_information,
    AIServiceError,
    AIResponseError,
)


SAMPLE_RESUME = """
Software Developer
Experience with Python and C++.
Completed a software engineering project.
"""

SAMPLE_FEEDBACK = {
    "strengths": ["Relevant programming skills."],
    "areas_for_improvement": ["Provide more project details."],
    "recommendations": ["Describe project achievements."],
}


@pytest.fixture(autouse=True)
def configure_test_environment(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-api-key")
    monkeypatch.setenv("GEMINI_MODEL", "test-model")

    with patch("src.main.ai_resume_service.load_dotenv"):
        yield


def test_generate_valid_feedback():
    with patch("google.genai.Client") as mock_client:
        client = mock_client.return_value

        client.models.generate_content.return_value.text = (
            json.dumps(SAMPLE_FEEDBACK)
        )

        result = generate_resume_feedback(SAMPLE_RESUME)

    assert result == SAMPLE_FEEDBACK


def test_missing_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with pytest.raises(AIServiceError, match="not configured"):
        generate_resume_feedback(SAMPLE_RESUME)


def test_empty_resume_text():
    with pytest.raises(ValueError, match="cannot be empty"):
        generate_resume_feedback("")


def test_invalid_json_response():
    with patch("google.genai.Client") as mock_client:
        client = mock_client.return_value

        client.models.generate_content.return_value.text = (
            "Invalid JSON"
        )

        with pytest.raises(AIResponseError):
            generate_resume_feedback(SAMPLE_RESUME)


def test_invalid_response_type():
    with patch("google.genai.Client") as mock_client:
        client = mock_client.return_value

        client.models.generate_content.return_value.text = "[]"

        with pytest.raises(AIResponseError):
            generate_resume_feedback(SAMPLE_RESUME)


def test_gemini_service_failure():
    with patch("google.genai.Client") as mock_client:
        client = mock_client.return_value

        client.models.generate_content.side_effect = (
            RuntimeError("Service unavailable")
        )

        with pytest.raises(AIServiceError):
            generate_resume_feedback(SAMPLE_RESUME)


def test_redact_email_address():
    result = redact_contact_information(
        "Email: test@example.com"
    )

    assert "test@example.com" not in result
    assert "[EMAIL REDACTED]" in result


def test_redact_phone_number():
    result = redact_contact_information(
        "Phone: 514-555-0123"
    )

    assert "514-555-0123" not in result
    assert "[PHONE REDACTED]" in result


def test_personal_information_not_sent_to_gemini():
    resume = SAMPLE_RESUME + "\nEmail: test@example.com"

    with patch("google.genai.Client") as mock_client:
        client = mock_client.return_value

        client.models.generate_content.return_value.text = (
            json.dumps(SAMPLE_FEEDBACK)
        )

        generate_resume_feedback(resume)

        arguments = (
            client.models.generate_content.call_args.kwargs
        )

        assert "test@example.com" not in arguments["contents"]
        assert "[EMAIL REDACTED]" in arguments["contents"]
        assert arguments["model"] == "test-model"