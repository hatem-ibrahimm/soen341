import uuid
from datetime import datetime, timezone

from flask import jsonify, request

if __package__:
    from .recruiter_postings import _recruiter_id
else:
    from recruiter_postings import _recruiter_id


INTERVIEW_STATUSES = frozenset(("scheduled", "completed", "cancelled"))
INTERVIEW_COLUMNS = (
    "id",
    "application_id",
    "scheduled_at",
    "location",
    "notes",
    "status",
    "reminder_sent_at",
    "created_at",
)


def _is_uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value.lower()
    except (ValueError, AttributeError):
        return False


def _serialize(row):
    result = dict(zip(INTERVIEW_COLUMNS, row))
    for field in ("id", "application_id"):
        result[field] = str(result[field])
    for field in ("scheduled_at", "reminder_sent_at", "created_at"):
        value = result[field]
        result[field] = value.isoformat() if hasattr(value, "isoformat") else value
    return result


def _validate_payload(payload, *, partial=False):
    if not isinstance(payload, dict) or not payload:
        return None, "Request body must be a non-empty JSON object."

    allowed = {"scheduled_at", "location", "notes", "status"}
    unknown = set(payload) - allowed
    if unknown:
        return None, f"Unsupported interview fields: {', '.join(sorted(unknown))}."

    clean = {}
    if not partial or "scheduled_at" in payload:
        value = payload.get("scheduled_at")
        if not isinstance(value, str):
            return None, "scheduled_at must be an ISO 8601 datetime."
        try:
            scheduled_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None, "scheduled_at must be a valid ISO 8601 datetime."
        if scheduled_at.tzinfo is None:
            return None, "scheduled_at must include a timezone."
        clean["scheduled_at"] = scheduled_at.astimezone(timezone.utc)

    for field, limit in (("location", 500), ("notes", 2000)):
        if field in payload:
            value = payload[field]
            if value is not None and not isinstance(value, str):
                return None, f"{field} must be text or null."
            text = (value or "").strip()
            if len(text) > limit:
                return None, f"{field} must be {limit} characters or fewer."
            clean[field] = text or None

    if "status" in payload:
        status = payload["status"]
        if status not in INTERVIEW_STATUSES:
            return None, "status must be scheduled, completed, or cancelled."
        clean["status"] = status

    if not partial and "scheduled_at" not in clean:
        return None, "scheduled_at is required."
    return clean, None


def register_interview_routes(app, get_connection, get_current_user):
    def recruiter_access():
        user = get_current_user()
        if user is None:
            return None, (jsonify({"error": "Authentication required."}), 401)
        try:
            recruiter_id = _recruiter_id(user, get_connection)
        except Exception:
            app.logger.exception("Recruiter role verification failed")
            return None, (jsonify({"error": "Unable to verify recruiter access."}), 503)
        if recruiter_id is None:
            return None, (jsonify({"error": "Recruiter access required."}), 403)
        return recruiter_id, None

    def owned_application(cursor, application_id, recruiter_id):
        cursor.execute(
            """
            SELECT a.applicant_id
            FROM public.applications AS a
            JOIN public.jobs AS j ON j.id = a.job_id
            WHERE a.id = %s AND j.recruiter_id = %s
            """,
            (application_id, recruiter_id),
        )
        row = cursor.fetchone()
        return str(row[0]) if row else None

    def load_interviews(cursor, application_id):
        cursor.execute(
            """
            SELECT id, application_id, scheduled_at, location, notes,
                   status, reminder_sent_at, created_at
            FROM public.interviews
            WHERE application_id = %s
            ORDER BY scheduled_at, id
            """,
            (application_id,),
        )
        return [_serialize(row) for row in cursor.fetchall()]

    @app.get("/api/recruiter/applications/<application_id>/interviews")
    def recruiter_list_interviews(application_id):
        recruiter_id, error = recruiter_access()
        if error:
            return error
        if not _is_uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            if owned_application(cursor, application_id, recruiter_id) is None:
                return jsonify({"error": "Application not found."}), 404
            return jsonify({"interviews": load_interviews(cursor, application_id)}), 200
        except Exception:
            app.logger.exception("Interview retrieval failed")
            return jsonify({"error": "Unable to retrieve interviews."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.post("/api/recruiter/applications/<application_id>/interviews")
    def recruiter_schedule_interview(application_id):
        recruiter_id, error = recruiter_access()
        if error:
            return error
        if not _is_uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400
        payload, error = _validate_payload(request.get_json(silent=True))
        if error:
            return jsonify({"error": error}), 400
        if payload.get("status", "scheduled") != "scheduled":
            return jsonify({"error": "New interviews must start as scheduled."}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            applicant_id = owned_application(cursor, application_id, recruiter_id)
            if applicant_id is None:
                conn.rollback()
                return jsonify({"error": "Application not found."}), 404
            cursor.execute(
                """
                INSERT INTO public.interviews (
                    application_id, scheduled_at, location, notes
                )
                VALUES (%s, %s, %s, %s)
                RETURNING id, application_id, scheduled_at, location, notes,
                          status, reminder_sent_at, created_at
                """,
                (
                    application_id,
                    payload["scheduled_at"],
                    payload.get("location"),
                    payload.get("notes"),
                ),
            )
            interview = _serialize(cursor.fetchone())
            cursor.execute(
                """
                INSERT INTO public.notifications (
                    user_id, application_id, type, title, message
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    applicant_id,
                    application_id,
                    "interview_scheduled",
                    "Interview scheduled",
                    "A recruiter scheduled an interview for your application.",
                ),
            )
            conn.commit()
            return jsonify({"interview": interview}), 201
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Interview scheduling failed")
            return jsonify({"error": "Unable to schedule interview."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.patch("/api/recruiter/applications/<application_id>/interviews/<interview_id>")
    def recruiter_update_interview(application_id, interview_id):
        recruiter_id, error = recruiter_access()
        if error:
            return error
        if not _is_uuid(application_id) or not _is_uuid(interview_id):
            return jsonify({"error": "Invalid interview ID."}), 400
        payload, error = _validate_payload(
            request.get_json(silent=True),
            partial=True,
        )
        if error:
            return jsonify({"error": error}), 400
        if not payload or set(payload) - {"status"}:
            return jsonify({"error": "Only interview status can be updated."}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            if owned_application(cursor, application_id, recruiter_id) is None:
                conn.rollback()
                return jsonify({"error": "Application not found."}), 404
            cursor.execute(
                """
                UPDATE public.interviews
                SET status = %s
                WHERE id = %s AND application_id = %s
                RETURNING id, application_id, scheduled_at, location, notes,
                          status, reminder_sent_at, created_at
                """,
                (payload["status"], interview_id, application_id),
            )
            row = cursor.fetchone()
            if row is None:
                conn.rollback()
                return jsonify({"error": "Interview not found."}), 404
            conn.commit()
            return jsonify({"interview": _serialize(row)}), 200
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Interview update failed")
            return jsonify({"error": "Unable to update interview."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.get("/api/applications/interviews")
    def applicant_list_interviews():
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        applicant_id = str(getattr(user, "id", ""))
        if not _is_uuid(applicant_id):
            return jsonify({"error": "Unable to retrieve interviews."}), 500

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT i.id, i.application_id, i.scheduled_at, i.location, i.notes,
                       i.status, i.reminder_sent_at, i.created_at
                FROM public.interviews AS i
                JOIN public.applications AS a ON a.id = i.application_id
                WHERE a.applicant_id = %s
                ORDER BY i.scheduled_at, i.id
                """,
                (applicant_id,),
            )
            return jsonify({
                "interviews": [_serialize(row) for row in cursor.fetchall()],
            }), 200
        except Exception:
            app.logger.exception("Applicant interview retrieval failed")
            return jsonify({"error": "Unable to retrieve interviews."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()
