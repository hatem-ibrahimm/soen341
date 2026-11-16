import uuid

from flask import jsonify, request

if __package__:
    from .application_tracking import APPLICATION_STATUSES
    from .recruiter_postings import _recruiter_id
else:
    from application_tracking import APPLICATION_STATUSES
    from recruiter_postings import _recruiter_id


DEFAULT_LIMIT = 20
MAX_LIMIT = 100
MAX_OFFSET = 100000
MAX_JOB_ID = (2**63) - 1


def _valid_uuid(value):
    if not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError):
        return False
    return True


def _pagination_value(name, default, minimum, maximum):
    raw = request.args.get(name)
    if raw is None:
        return default, None
    if not raw.isascii() or not raw.isdecimal():
        return None, f"{name} must be an integer between {minimum} and {maximum}."
    value = int(raw)
    if not minimum <= value <= maximum:
        return None, f"{name} must be an integer between {minimum} and {maximum}."
    return value, None


def _serialize_application(row, *, details=False):
    """Return only applicant information relevant to recruiter review.

    SQL column order is fixed below; never expose resume storage_path or
    unrelated profile fields. A resume download needs a separate authorized API.
    """
    created_at = row[5]
    data = {
        "id": str(row[0]),
        "applicant_id": str(row[1]),
        "job_id": row[2],
        "resume_id": str(row[3]) if row[3] is not None else None,
        "status": row[4],
        "submitted_at": (
            created_at.isoformat()
            if hasattr(created_at, "isoformat")
            else str(created_at)
        ),
        "applicant": {
            "id": str(row[1]),
            "first_name": row[6],
            "last_name": row[7],
            "email": row[8],
        },
        "resume": (
            {"id": str(row[3]), "file_name": row[9]}
            if row[3] is not None else None
        ),
    }
    if details:
        data["cover_letter"] = row[10]
    return data


def register_recruiter_applicant_routes(app, get_connection, get_current_user):
    """Register read-only recruiter applicant endpoints on an existing app."""

    def authorize():
        user = get_current_user()
        if user is None:
            return None, (jsonify({"error": "Authentication required."}), 401)
        recruiter_id = _recruiter_id(user)
        if recruiter_id is None:
            return None, (jsonify({"error": "Recruiter access required."}), 403)
        return recruiter_id, None

    @app.get("/api/recruiter/jobs/<int:job_id>/applications")
    def recruiter_list_job_applications(job_id):
        recruiter_id, error = authorize()
        if error:
            return error
        if not 1 <= job_id <= MAX_JOB_ID:
            return jsonify({"error": "Invalid job ID."}), 400

        status = request.args.get("status")
        if status is not None and status not in APPLICATION_STATUSES:
            return jsonify({"error": "Invalid application status filter."}), 400

        limit, error = _pagination_value("limit", DEFAULT_LIMIT, 1, MAX_LIMIT)
        if error:
            return jsonify({"error": error}), 400
        offset, error = _pagination_value("offset", 0, 0, MAX_OFFSET)
        if error:
            return jsonify({"error": error}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()

            # Never reveal a posting's existence if another recruiter owns it.
            cursor.execute(
                "SELECT id FROM public.jobs WHERE id = %s AND recruiter_id = %s",
                (job_id, recruiter_id),
            )
            if cursor.fetchone() is None:
                return jsonify({"error": "Job posting not found."}), 404

            sql = """
                SELECT a.id, a.applicant_id, a.job_id, a.resume_id,
                       a.status, a.created_at, p.first_name, p.last_name,
                       p.email, r.file_name
                FROM public.applications AS a
                JOIN public.jobs AS j ON j.id = a.job_id
                LEFT JOIN public.profiles AS p ON p.id = a.applicant_id
                LEFT JOIN public.resumes AS r ON r.id = a.resume_id
                WHERE j.id = %s AND j.recruiter_id = %s
            """
            params = [job_id, recruiter_id]
            if status is not None:
                sql += " AND a.status = %s"
                params.append(status)
            sql += " ORDER BY a.created_at DESC, a.id DESC LIMIT %s OFFSET %s"
            params.extend((limit + 1, offset))
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall()
            return jsonify({
                "applications": [
                    _serialize_application(row) for row in rows[:limit]
                ],
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": len(rows) > limit,
                },
            }), 200
        except Exception:
            app.logger.exception("Recruiter applicant listing failed")
            return jsonify({"error": "Unable to retrieve job applications."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.get("/api/recruiter/applications/<application_id>")
    def recruiter_get_application(application_id):
        recruiter_id, error = authorize()
        if error:
            return error
        if not _valid_uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT a.id, a.applicant_id, a.job_id, a.resume_id,
                       a.status, a.created_at, p.first_name, p.last_name,
                       p.email, r.file_name, a.cover_letter
                FROM public.applications AS a
                JOIN public.jobs AS j ON j.id = a.job_id
                LEFT JOIN public.profiles AS p ON p.id = a.applicant_id
                LEFT JOIN public.resumes AS r ON r.id = a.resume_id
                WHERE a.id = %s AND j.recruiter_id = %s
                """,
                (application_id, recruiter_id),
            )
            row = cursor.fetchone()
            if row is None:
                return jsonify({"error": "Application not found."}), 404
            return jsonify({
                "application": _serialize_application(row, details=True),
            }), 200
        except Exception:
            app.logger.exception("Recruiter application retrieval failed")
            return jsonify({"error": "Unable to retrieve application."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()
