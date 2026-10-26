"""Sprint 2 job-application submission.

Keep the application endpoint separate from teammates' existing authentication,
profile and resume handlers. Database table contracts are documented in the
Sprint 2 implementation notes and must be confirmed with the database owner.
"""

import uuid

from flask import jsonify, request


MAX_COVER_LETTER_LENGTH = 2000


def _valid_uuid(value):
    if not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


def _parse_job_id(value):
    """Return a positive PostgreSQL job ID, or None for invalid inputs.

    The latest team job-listing API uses /api/jobs/<int:job_id>.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        job_id = value
    elif isinstance(value, str) and value.isascii() and value.isdecimal():
        job_id = int(value)
    else:
        return None
    return job_id if 0 < job_id <= (2**63 - 1) else None


def _format_application(row):
    """Map the agreed SQL result columns to an API-friendly response."""
    submitted_at = row[5]
    return {
        "id": str(row[0]),
        "applicant_id": str(row[1]),
        "job_id": row[2],
        "resume_id": str(row[3]) if row[3] is not None else None,
        "status": row[4],
        "submitted_at": submitted_at.isoformat() if hasattr(submitted_at, "isoformat") else str(submitted_at),
    }


def register_application_submission_routes(app, get_connection, get_current_user):
    """Install submission route using the current app's auth and DB helpers."""

    @app.post("/api/applications")
    def submit_job_application():
        # Don't trust an applicant/user identifier from the request body.
        # Reuse Supabase Auth token validation already in this repository.
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400

        job_id = _parse_job_id(payload.get("job_id"))
        resume_id = payload.get("resume_id")
        cover_letter = payload.get("cover_letter", "")

        if job_id is None:
            return jsonify({"error": "job_id must be a positive integer."}), 400
        if resume_id is not None and not _valid_uuid(resume_id):
            return jsonify({"error": "resume_id must be a valid UUID."}), 400
        if not isinstance(cover_letter, str):
            return jsonify({"error": "cover_letter must be text."}), 400
        cover_letter = cover_letter.strip()
        if len(cover_letter) > MAX_COVER_LETTER_LENGTH:
            return jsonify({"error": "cover_letter must be 2000 characters or fewer."}), 400

        applicant_id = str(user.id)
        if not _valid_uuid(applicant_id):
            app.logger.error("Authenticated Supabase user ID is not a UUID")
            return jsonify({"error": "Unable to submit application."}), 500

        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()

            # The team's latest /api/jobs endpoint treats 'published' jobs
            # as available and uses integer job IDs. Hatem must still
            # confirm the deployed schema before integration testing.
            cursor.execute(
                "SELECT id FROM public.jobs WHERE id = %s AND status = %s",
                (job_id, "published"),
            )
            if cursor.fetchone() is None:
                return jsonify({"error": "Job not found or not open for applications."}), 404

            # The optional resume must belong to the authenticated user.
            # Existing backend resume code uses resumes.profile_id as owner.
            if resume_id is not None:
                cursor.execute(
                    "SELECT id FROM resumes WHERE id = %s AND profile_id = %s",
                    (resume_id, applicant_id),
                )
                if cursor.fetchone() is None:
                    return jsonify({"error": "Resume not found for this account."}), 404

            # The database must enforce UNIQUE(applicant_id, job_id).
            cursor.execute(
                """
                INSERT INTO applications (applicant_id, job_id, resume_id, cover_letter, status)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, applicant_id, job_id, resume_id, status, created_at
                """,
                (applicant_id, job_id, resume_id, cover_letter or None, "Applied"),
            )
            row = cursor.fetchone()
            conn.commit()

            return jsonify({
                "message": "Application submitted successfully.",
                "application": _format_application(row),
            }), 201
        except Exception as exc:
            if conn is not None:
                conn.rollback()
            if getattr(exc, "pgcode", None) == "23505":
                return jsonify({"error": "You have already applied to this job."}), 409
            app.logger.exception("Job application submission failed")
            return jsonify({"error": "Unable to submit application at this time."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()
