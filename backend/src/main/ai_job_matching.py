
import re
import uuid

from flask import jsonify

if __package__:
    from .ai_job_matching_service import (
        generate_job_matches,
        JobMatchingServiceError,
        JobMatchingResponseError,
    )
    from .resume_text_extraction import extract_resume_text
else:
    from ai_job_matching_service import (
        generate_job_matches,
        JobMatchingServiceError,
        JobMatchingResponseError,
    )
    from resume_text_extraction import extract_resume_text


MAX_JOB_CANDIDATES = 50
MAX_RESUME_CHARACTERS = 20000


def redact_contact_information(text):
    """Remove common email addresses and phone numbers."""

    text = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "[EMAIL REDACTED]",
        text,
    )

    text = re.sub(
        r"(?<!\w)(?:\+?1[-.\s]?)?"
        r"(?:\(\d{3}\)|\d{3})[-.\s]?"
        r"\d{3}[-.\s]?\d{4}(?!\w)",
        "[PHONE REDACTED]",
        text,
    )

    return text


def register_ai_job_matching_routes(
    app,
    get_connection,
    get_current_user,
    get_resume_storage,
):

    @app.post("/api/profiles/<profile_id>/job-matches")
    def job_matches(profile_id):

        user = get_current_user()

        if user is None:
            return jsonify({
                "error": "Authentication required."
            }), 401

        try:
            uuid.UUID(profile_id)
        except (ValueError, TypeError, AttributeError):
            return jsonify({
                "error": "Invalid profile ID."
            }), 400

        if str(user.id).lower() != profile_id.lower():
            return jsonify({
                "error": "Access denied."
            }), 403

        connection = None
        cursor = None
        resume_text = ""
        warnings = []

        try:
            connection = get_connection()
            cursor = connection.cursor()

            # Retrieve the user's profile.
            cursor.execute(
                """
                SELECT title, bio
                FROM public.profiles
                WHERE id = %s
                """,
                (profile_id,),
            )

            profile_row = cursor.fetchone()

            if profile_row is None:
                return jsonify({
                    "error": "Profile not found."
                }), 404

            profile = {
                "title": redact_contact_information(
                    profile_row[0] or ""
                ),
                "bio": redact_contact_information(
                    profile_row[1] or ""
                ),
            }

            # Retrieve the user's skills.
            cursor.execute(
                """
                SELECT name
                FROM public.skills
                WHERE profile_id = %s
                """,
                (profile_id,),
            )


            profile["skills"] = [
                redact_contact_information(row[0])
                for row in cursor.fetchall()
                if row[0]
            ]

            # Retrieve the user's work experience
            cursor.execute(
                """
                SELECT job_title, company, dates, description
                FROM public.work_experiences
                WHERE profile_id = %s
                ORDER BY display_order, created_at
                """,
                (profile_id,),
            )

            profile["work_experience"] = [
                {
                    "job_title": redact_contact_information(row[0] or ""),
                    "company": redact_contact_information(row[1] or ""),
                    "dates": redact_contact_information(row[2] or ""),
                    "description": redact_contact_information(row[3] or ""),
                }
                for row in cursor.fetchall()
            ]

            # Retrieve the user's education
            cursor.execute(
                """
                SELECT school, degree, years
                FROM public.education
                WHERE profile_id = %s
                ORDER BY display_order, created_at
                """,
                (profile_id,),
            )

            profile["education"] = [
                {
                    "school": redact_contact_information(row[0] or ""),
                    "degree": redact_contact_information(row[1] or ""),
                    "years": redact_contact_information(row[2] or ""),
                }
                for row in cursor.fetchall()
            ]

            # Retrieve the uploaded resume
            cursor.execute(
                """
                SELECT file_name, storage_path
                FROM public.resumes
                WHERE profile_id = %s
                """,
                (profile_id,),
            )

            resume = cursor.fetchone()

            # Retrieve available job postings
            cursor.execute(
                """
                SELECT id, title, company_name, location,
                       category, description, required_skills
                FROM public.jobs
                WHERE status = 'published'
                  AND (
                      application_deadline IS NULL
                      OR application_deadline >= CURRENT_DATE
                  )
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (MAX_JOB_CANDIDATES,),
            )

            columns = [
                column[0] for column in cursor.description
            ]

            jobs = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]

        except Exception:
            app.logger.error("Job matching data retrieval failed")

            return jsonify({
                "error": "Unable to retrieve job matching data."
            }), 500

        finally:
            if cursor is not None:
                cursor.close()

            if connection is not None:
                connection.close()

        # No AI request is needed if there are no jobs.
        if not jobs:
            return jsonify({
                "recommendations": [],
                "message": "No available job postings found.",
                "warnings": [],
            }), 200

        # Extract resume text if a resume exists.
        if resume is not None:
            file_name, storage_path = resume

            try:
                file_bytes = get_resume_storage().download(
                    storage_path
                )

                resume_text = extract_resume_text(
                    file_bytes,
                    file_name,
                )

                resume_text = redact_contact_information(
                    resume_text
                )[:MAX_RESUME_CHARACTERS]

            except Exception:
                app.logger.warning(
                    "Resume unavailable for job matching"
                )

                warnings.append(
                    "Resume could not be analyzed. "
                    "Recommendations are based on your profile."
                )

        else:
            warnings.append(
                "No resume uploaded. "
                "Recommendations are based on your profile."
            )

        # Avoid generating recommendations without qualifications.
        if not any(profile.values()) and not resume_text.strip():
            return jsonify({
                "error": (
                    "Add information to your profile or upload "
                    "a resume before generating job matches."
                )
            }), 400

        try:
            # Generate AI recommendations.
            recommendations = generate_job_matches(
                profile,
                resume_text,
                jobs,
            )

            # Attach actual database job information.
            jobs_by_id = {
                job["id"]: job for job in jobs
            }

            results = []

            for recommendation in recommendations:
                job = jobs_by_id[recommendation["job_id"]]

                results.append({
                    **recommendation,
                    "job": job,
                })

            return jsonify({
                "recommendations": results,
                "resume_used": bool(resume_text),
                "jobs_analyzed": len(jobs),
                "warnings": warnings,
            }), 200

        except JobMatchingServiceError:
            return jsonify({
                "error": (
                    "AI job matching is temporarily unavailable. "
                    "Please try again later."
                )
            }), 503

        except JobMatchingResponseError:
            return jsonify({
                "error": (
                    "Invalid AI recommendations received. "
                    "Please try again."
                )
            }), 502

        except Exception:
            app.logger.error("AI job matching failed")

            return jsonify({
                "error": "Unable to generate job recommendations."
            }), 500
