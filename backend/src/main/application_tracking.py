
import uuid

from flask import jsonify, request
from src.main.email_service import send_email

APPLICATION_STATUSES = frozenset(
    ("Applied", "Under Review", "Interview", "Offered", "Rejected")
)
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_OFFSET = 100000


def _is_uuid(value):
    if not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError):
        return False
    return True


def _application_dict(row):
    """Convert a database application row into a JSON-friendly dictionary."""
    created_at = row[5]
    return {
        "id": str(row[0]),
        "applicant_id": str(row[1]),
        "job_id": row[2],
        "resume_id": str(row[3]) if row[3] is not None else None,
        "status": str(row[4]),
        "submitted_at": (
            created_at.isoformat()
            if hasattr(created_at, "isoformat")
            else str(created_at)
        ),
    }


def _page_integer(name, default, minimum, maximum):
    """Validate pagination parameters."""
    raw = request.args.get(name)
    if raw is None:
        return default, None
    if not raw.isdecimal():
        return None, f"{name} must be an integer between {minimum} and {maximum}."
    value = int(raw)
    if not minimum <= value <= maximum:
        return None, f"{name} must be an integer between {minimum} and {maximum}."
    return value, None


def register_application_tracking_routes(app, get_connection, get_current_user):
    """Register application tracking endpoints."""

    @app.get("/api/applications")
    def list_my_applications():
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        applicant_id = str(user.id)
        if not _is_uuid(applicant_id):
            app.logger.error("Authenticated user ID is not a UUID")
            return jsonify({"error": "Unable to retrieve applications."}), 500

        status = request.args.get("status")
        if status is not None and status not in APPLICATION_STATUSES:
            return jsonify({"error": "Invalid application status filter."}), 400

        limit, error = _page_integer("limit", DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
        if error:
            return jsonify({"error": error}), 400
        offset, error = _page_integer("offset", 0, 0, MAX_OFFSET)
        if error:
            return jsonify({"error": error}), 400

        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            if status is None:
                cursor.execute(
                    """
                    SELECT id, applicant_id, job_id, resume_id, status, created_at
                    FROM applications
                    WHERE applicant_id = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT %s OFFSET %s
                    """,
                    (applicant_id, limit + 1, offset),
                )
            else:
                cursor.execute(
                    """
                    SELECT id, applicant_id, job_id, resume_id, status, created_at
                    FROM applications
                    WHERE applicant_id = %s AND status = %s
                    ORDER BY created_at DESC, id DESC
                    LIMIT %s OFFSET %s
                    """,
                    (applicant_id, status, limit + 1, offset),
                )
            rows = cursor.fetchall()
            return jsonify({
                "applications": [_application_dict(row) for row in rows[:limit]],
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": len(rows) > limit,
                },
            }), 200

        except Exception:
            app.logger.exception("Application list retrieval failed")
            return jsonify({"error": "Unable to retrieve applications."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.get("/api/applications/<application_id>")
    def get_my_application(application_id):
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        if not _is_uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400

        applicant_id = str(user.id)
        if not _is_uuid(applicant_id):
            app.logger.error("Authenticated user ID is not a UUID")
            return jsonify({"error": "Unable to retrieve application."}), 500

        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, applicant_id, job_id, resume_id, status, created_at
                FROM applications
                WHERE id = %s AND applicant_id = %s
                """,
                (application_id, applicant_id),
            )
            row = cursor.fetchone()
            if row is None:
                return jsonify({"error": "Application not found."}), 404
            return jsonify({"application": _application_dict(row)}), 200
        except Exception:
            app.logger.exception("Application detail retrieval failed")
            return jsonify({"error": "Unable to retrieve application."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.patch("/api/applications/<application_id>/status")
    def update_application_status(application_id):
        """Update an application and notify the applicant of status changes."""
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        if not _is_uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400

        status = payload.get("status")
        if not isinstance(status, str) or status not in APPLICATION_STATUSES:
            return jsonify({"error": "Invalid application status."}), 400

        recruiter_id = str(user.id)
        if not _is_uuid(recruiter_id):
            app.logger.error("Authenticated user ID is not a UUID")
            return jsonify({"error": "Unable to update application status."}), 500

        conn = None
        cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()

            # Verify recruiter ownership and retrieve previous status.
            cursor.execute(
                """
                SELECT a.status
                FROM applications AS a
                JOIN jobs AS j ON a.job_id = j.id
                WHERE a.id = %s
                    AND j.recruiter_id = %s
                FOR UPDATE OF a
                """,
                (application_id, recruiter_id),
            )

            previous_row = cursor.fetchone()

            if previous_row is None:
                conn.rollback()
                return jsonify({"error": "Application not found."}), 404

            previous_status = previous_row[0]

            # Update application status.
            cursor.execute(
                """
                UPDATE applications AS a
                SET status = %s
                FROM jobs AS j
                WHERE a.id = %s
                    AND a.job_id = j.id
                    AND j.recruiter_id = %s
                RETURNING a.id, a.applicant_id, a.job_id,
                          a.resume_id, a.status, a.created_at
                """,
                (status, application_id, recruiter_id),
            )

            row = cursor.fetchone()

            if row is None:
                conn.rollback()
                return jsonify({"error": "Application not found."}), 404

            status_changed = previous_status != status

            # Create in-app notification only when status changes.
            if status_changed:
                cursor.execute(
                    """
                    INSERT INTO notifications (
                        user_id,
                        application_id,
                        type,
                        title,
                        message
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        str(row[1]),
                        str(row[0]),
                        "application_status",
                        "Application Status Updated",
                        f"Your application status has changed to {status}.",
                    ),
                )

            # Save database changes before attempting email.
            conn.commit()

            response_data = {
                "message": "Application status updated successfully.",
                "application": _application_dict(row),
            }

        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Application status update failed")
            return jsonify({"error": "Unable to update application status."}), 500

        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

        # EMAIL FEATURE
        # Email errors must never undo the successful status update.
        if status_changed:
            email_conn = None
            email_cursor = None

            try:
                email_conn = get_connection()
                email_cursor = email_conn.cursor()

                # Retrieve the applicant's email from their profile.
                email_cursor.execute(
                    """
                    SELECT email
                    FROM profiles
                    WHERE id = %s
                    """,
                    (str(row[1]),),
                )

                email_row = email_cursor.fetchone()

                if email_row and isinstance(email_row[0], str) and email_row[0]:
                    send_email(
                        email_row[0],
                        "CareerConnect - Application Status Updated",
                        f"Your application status has changed to {status}.",
                    )

            except Exception:
                app.logger.warning(
                    "Optional status update email could not be sent.",
                    exc_info=True,
                )

            finally:
                if email_cursor is not None:
                    email_cursor.close()
                if email_conn is not None:
                    email_conn.close()

        return jsonify(response_data), 200
