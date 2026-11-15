
import json
from unittest.mock import MagicMock, patch

from src.main.ai_resume_service import generate_resume_feedback


class TestAIResumeFeedback:

    def test_generate_feedback_success(self):
        """Test that Gemini returns the three required feedback sections."""

        mock_feedback = {
            "strengths": [
                "Relevant technical skills are listed."
            ],
            "areas_for_improvement": [
                "Work experience needs more details."
            ],
            "recommendations": [
                "Add measurable achievements."
            ]
        }

        mock_response = MagicMock()
        mock_response.text = json.dumps(mock_feedback)

        with patch("src.main.ai_resume_service.genai.Client") as mock_client:
            mock_client.return_value.models.generate_content.return_value = mock_response

            feedback = generate_resume_feedback(
                "Alex Smith. Skills: Python and Flask."
            )

        assert feedback == mock_feedback

    def test_generate_feedback_has_required_sections(self):
        """Test that the response contains the three required sections."""

        mock_feedback = {
            "strengths": ["Good education section."],
            "areas_for_improvement": ["Missing contact information."],
            "recommendations": ["Add an email address."]
        }

        mock_response = MagicMock()
        mock_response.text = json.dumps(mock_feedback)

        with patch("src.main.ai_resume_service.genai.Client") as mock_client:
            mock_client.return_value.models.generate_content.return_value = mock_response

            feedback = generate_resume_feedback(
                "Education: Computer Engineering."
            )

        assert "strengths" in feedback
        assert "areas_for_improvement" in feedback
        assert "recommendations" in feedback

        assert isinstance(feedback["strengths"], list)
        assert isinstance(feedback["areas_for_improvement"], list)
        assert isinstance(feedback["recommendations"], list)

    def test_generate_feedback_uses_correct_model(self):
        """Test that the correct Gemini model is requested."""

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "strengths": [],
            "areas_for_improvement": [],
            "recommendations": []
        })

        with patch("src.main.ai_resume_service.genai.Client") as mock_client:
            mock_client.return_value.models.generate_content.return_value = mock_response

            generate_resume_feedback("Sample resume")

            call_args = mock_client.return_value.models.generate_content.call_args

            assert call_args.kwargs["model"] == "gemini-3.8-flash"
