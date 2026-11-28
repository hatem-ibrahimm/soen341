import json
import uuid

from flask import jsonify, request

if __package__:
    from .ai_resume_service import (
        generate_resume_feedback,
        AIServiceError,
        AIResponseError,
    )
    from .resume_text_extraction import extract_resume_text
else:
    from ai_resume_service import (
        generate_resume_feedback,
        AIServiceError,
        AIResponseError,
    )
    from resume_text_extraction import extract_resume_text

FEEDBACK_FIELDS = (
    "strengths",
    "areas_for_improvement",
    "recommendations",
)


def _clean_feedback(feedback):
    """Validate and clean the structured AI feedback."""

    if not isinstance(feedback, dict):
        raise AIResponseError(
            "The AI service returned invalid feedback."
        )

    if set(feedback.keys()) != set(FEEDBACK_FIELDS):
        raise AIResponseError(
            "The AI service returned unexpected feedback categories."
        )

    clean = {}

    for field in FEEDBACK_FIELDS:
        items = feedback.get(field)

        if not isinstance(items, list) or any(
            not isinstance(item, str) or not item.strip()
            for item in items
        ):
            raise AIResponseError(
                "The AI service returned invalid feedback."
            )

        clean[field] = [item.strip() for item in items]

    if not any(clean.values()):
        raise AIResponseError(
            "The AI service returned empty feedback."
        )

    return clean


def _isoformat(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def register_ai_resume_feedback_routes(
    app, get_connection, get_current_user, get_resume_storage
):
    @app.route(
        "/api/profiles/<profile_id>/resume/feedback",
        methods=["GET", "POST"],
    )
    def resume_feedback(profile_id):
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        try:
            uuid.UUID(profile_id)
        except (ValueError, TypeError, AttributeError):
            return jsonify({"error": "Invalid profile ID."}), 400

        if str(user.id).lower() != profile_id.lower():
            return jsonify({"error": "Access denied."}), 403

        connection = cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()

            if request.method == "GET":
                cursor.execute(
                    """
                    SELECT f.resume_id, f.strengths,
                           f.areas_for_improvement, f.recommendations,
                           f.generated_at
                    FROM public.resume_feedback AS f
                    JOIN public.resumes AS r ON r.id = f.resume_id
                    WHERE r.profile_id = %s
                      AND f.resume_updated_at = r.uploaded_at
                    """,
                    (profile_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    return jsonify({"feedback": None}), 200
                resume_id, strengths, improvements, recommendations, generated_at = row
                return jsonify({
                    "feedback": {
                        "resume_id": str(resume_id),
                        "strengths": strengths,
                        "areas_for_improvement": improvements,
                        "recommendations": recommendations,
                        "generated_at": _isoformat(generated_at),
                    },
                }), 200

            cursor.execute(
                """
                SELECT id, file_name, storage_path, uploaded_at
                FROM public.resumes
                WHERE profile_id = %s
                """,
                (profile_id,),
            )
            resume = cursor.fetchone()
            if resume is None:
                return jsonify({"error": "Resume not found."}), 404

            resume_id, file_name, storage_path, uploaded_at = resume
            file_bytes = get_resume_storage().download(storage_path)
            try:
                resume_text = extract_resume_text(file_bytes, file_name)
            except ValueError as error:
                return jsonify({"error": str(error)}), 400

            feedback = _clean_feedback(generate_resume_feedback(resume_text))
            cursor.execute(
                """
                SELECT uploaded_at, storage_path
                FROM public.resumes
                WHERE id = %s AND profile_id = %s
                FOR UPDATE
                """,
                (resume_id, profile_id),
            )

            current_resume = cursor.fetchone()

            if current_resume != (uploaded_at, storage_path):
                connection.rollback()

                return jsonify({
                    "error": "Resume changed during analysis. Please try again."
                }), 409
            
            cursor.execute(
                """
                INSERT INTO public.resume_feedback (
                    resume_id, resume_updated_at, strengths,
                    areas_for_improvement, recommendations
                )
                VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb)
                ON CONFLICT (resume_id) DO UPDATE SET
                    resume_updated_at = EXCLUDED.resume_updated_at,
                    strengths = EXCLUDED.strengths,
                    areas_for_improvement = EXCLUDED.areas_for_improvement,
                    recommendations = EXCLUDED.recommendations,
                    generated_at = now()
                RETURNING generated_at
                """,
                (
                    resume_id,
                    uploaded_at,
                    json.dumps(feedback["strengths"]),
                    json.dumps(feedback["areas_for_improvement"]),
                    json.dumps(feedback["recommendations"]),
                ),
            )
            generated_at = cursor.fetchone()[0]
            connection.commit()
            return jsonify({
                "resume_id": str(resume_id),
                **feedback,
                "generated_at": _isoformat(generated_at),
            }), 200
        except AIServiceError:
            if connection is not None:
                connection.rollback()

            app.logger.warning("AI resume service unavailable")

            return jsonify({
                "error": "AI resume feedback is temporarily unavailable."
            }), 503

        except AIResponseError:
            if connection is not None:
                connection.rollback()

            app.logger.warning("Invalid AI resume feedback received")

            return jsonify({
                "error": "Invalid AI feedback received. Please try again."
            }), 502

        except Exception:
            if connection is not None:
                connection.rollback()

            app.logger.error("AI resume feedback request failed")

            return jsonify({
                "error": "Unable to analyze resume."
            }), 500
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()
