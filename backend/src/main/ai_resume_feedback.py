
from flask import jsonify
from .resume_text_extraction import extract_resume_text
from .ai_resume_service import generate_resume_feedback


def register_ai_resume_feedback_routes(
    app, get_connection, get_current_user, get_resume_storage
):
    """Register the AI resume feedback endpoint."""

    @app.route(
        "/api/profiles/<profile_id>/resume/feedback",
        methods=["POST"],
    )
    def analyze_resume(profile_id):
        """Analyze the authenticated user's uploaded resume."""

        # Check authentication.
        user = get_current_user()

        if user is None:
            return jsonify({
                "error": "Authentication required."
            }), 401

        # Check that the profile ID is valid.
        from uuid import UUID

        try:
            UUID(profile_id)
        except (ValueError, TypeError):
            return jsonify({
                "error": "Invalid profile ID."
            }), 400

        # Only allow users to analyze their own resumes.
        if str(user.id).lower() != profile_id.lower():
            return jsonify({
                "error": "Access denied."
            }), 403

        connection = None

        try:
            # Connect to the database.
            connection = get_connection()
            cursor = connection.cursor()

            # Find the user's uploaded resume.
            cursor.execute(
                """
                SELECT id, file_name, storage_path, content_type
                FROM resumes
                WHERE profile_id = %s
                """,
                (profile_id,),
            )

            row = cursor.fetchone()

            if row is None:
                return jsonify({
                    "error": "Resume not found."
                }), 404

            resume_id, file_name, storage_path, content_type = row

            # Download the resume from Supabase Storage.
            storage = get_resume_storage()
            file_bytes = storage.download(storage_path)

            # Extract the text from the resume.
            try:
                resume_text = extract_resume_text(
                    file_bytes,
                    file_name
                )
            except ValueError as error:
                return jsonify({
                    "error": str(error)
                }), 400

            feedback = generate_resume_feedback(resume_text)

            return jsonify({
                "resume_id": str(resume_id),
                "strengths": feedback["strengths"],
                "areas_for_improvement": feedback["areas_for_improvement"],
                "recommendations": feedback["recommendations"]
            }), 200

        except Exception:
            app.logger.exception("AI resume feedback failed")

            return jsonify({
                "error": "Unable to analyze resume."
            }), 500

        finally:
            if connection is not None:
                connection.close()
