
import uuid
from decimal import Decimal, InvalidOperation

from flask import jsonify, request


JOB_STATUSES = frozenset(("draft", "published", "closed"))
REQUIRED_TEXT_FIELDS = {
    "title": 160,
    "company_name": 160,
    "description": 10000,
    "location": 200,
    "category": 100,
}
EDITABLE_FIELDS = frozenset({
    *REQUIRED_TEXT_FIELDS,
    "required_skills", "min_salary", "max_salary", "status",
})
MAX_SALARY = Decimal("1000000000")
JOB_COLUMNS = (
    "id", "recruiter_id", "title", "company_name", "location", "category",
    "description", "required_skills", "min_salary", "max_salary",
    "status", "created_at",
)
JOB_RETURNING = ", ".join(JOB_COLUMNS)
MAX_PAGE_SIZE = 100


def _uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value.lower()
    except (ValueError, AttributeError):
        return False


def _recruiter_id(user):
    """Trust only administrator-controlled Supabase app_metadata, not user_metadata.

    The team must provision recruiters with app_metadata.role='recruiter'
    (or app_metadata.roles containing 'recruiter') using a trusted admin flow.
    """
    if user is None:
        return None
    metadata = getattr(user, "app_metadata", None)
    if not isinstance(metadata, dict):
        return None
    roles = metadata.get("roles", [])
    has_role = metadata.get("role") == "recruiter" or (
        isinstance(roles, (list, tuple)) and "recruiter" in roles
    )
    if not has_role:
        return None
    user_id = str(getattr(user, "id", ""))
    return user_id if _uuid(user_id) else None


def _validated_salary(value, field):
    if value is None:
        return None, None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None, f"{field} must be a non-negative number or null."
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None, f"{field} must be a valid number."
    if not amount.is_finite() or amount < 0 or amount > MAX_SALARY:
        return None, f"{field} must be between 0 and 1000000000."
    if amount.as_tuple().exponent < -2:
        return None, f"{field} may contain at most two decimal places."
    return amount, None


def _validate_fields(payload, *, partial=False):
    """Return (cleaned_fields, error). Unknown and protected fields are rejected."""
    if not isinstance(payload, dict):
        return None, "Request body must be a JSON object."
    if not partial:
        absent = [name for name in REQUIRED_TEXT_FIELDS if name not in payload]
        if absent:
            return None, f"Missing required fields: {', '.join(sorted(absent))}."
    if not payload and partial:
        return None, "Provide at least one job field to update."
    unknown = set(payload) - EDITABLE_FIELDS
    if unknown:
        return None, f"Unsupported or protected fields: {', '.join(sorted(unknown))}."

    cleaned = {}
    for field, limit in REQUIRED_TEXT_FIELDS.items():
        if field in payload:
            value = payload[field]
            if not isinstance(value, str) or not value.strip():
                return None, f"{field} must be non-empty text."
            if len(value.strip()) > limit:
                return None, f"{field} must be {limit} characters or fewer."
            cleaned[field] = value.strip()

    if "required_skills" in payload:
        skills = payload["required_skills"]
        if not isinstance(skills, list) or len(skills) > 30:
            return None, "required_skills must be a list of at most 30 skills."
        normalized = []
        seen = set()
        for skill in skills:
            if not isinstance(skill, str) or not skill.strip() or len(skill.strip()) > 80:
                return None, "Each required skill must be non-empty text of at most 80 characters."
            value = skill.strip()
            if value.casefold() not in seen:
                normalized.append(value)
                seen.add(value.casefold())
        cleaned["required_skills"] = normalized

    for field in ("min_salary", "max_salary"):
        if field in payload:
            amount, error = _validated_salary(payload[field], field)
            if error:
                return None, error
            cleaned[field] = amount

    if "status" in payload:
        if not isinstance(payload["status"], str) or payload["status"] not in JOB_STATUSES:
            return None, "status must be draft, published, or closed."
        cleaned["status"] = payload["status"]

    if not partial:
        cleaned.setdefault("required_skills", [])
        cleaned.setdefault("min_salary", None)
        cleaned.setdefault("max_salary", None)
        cleaned.setdefault("status", "draft")
        minimum, maximum = cleaned["min_salary"], cleaned["max_salary"]
        if minimum is not None and maximum is not None and minimum > maximum:
            return None, "min_salary cannot exceed max_salary."
    return cleaned, None


def _job_dict(row):
    result = dict(zip(JOB_COLUMNS, row))
    result["recruiter_id"] = str(result["recruiter_id"])
    result["required_skills"] = result["required_skills"] or []
    for field in ("min_salary", "max_salary"):
        result[field] = float(result[field]) if result[field] is not None else None
    value = result["created_at"]
    result["created_at"] = value.isoformat() if hasattr(value, "isoformat") else str(value)
    return result


def _pagination():
    result = {}
    for name, default, lower, upper in (("limit", 20, 1, MAX_PAGE_SIZE), ("offset", 0, 0, 100000)):
        raw = request.args.get(name)
        if raw is None:
            result[name] = default
        elif not raw.isascii() or not raw.isdecimal() or not lower <= int(raw) <= upper:
            return None, f"{name} must be an integer between {lower} and {upper}."
        else:
            result[name] = int(raw)
    return result, None


def register_recruiter_posting_routes(app, get_connection, get_current_user):
    """Register recruiter-only CRUD subset without changing existing /api/jobs."""

    def authorize():
        user = get_current_user()
        if user is None:
            return None, (jsonify({"error": "Authentication required."}), 401)
        recruiter = _recruiter_id(user)
        if recruiter is None:
            return None, (jsonify({"error": "Recruiter access required."}), 403)
        return recruiter, None

    @app.post("/api/recruiter/jobs")
    def recruiter_create_job():
        recruiter, error = authorize()
        if error:
            return error
        data, error = _validate_fields(request.get_json(silent=True))
        if error:
            return jsonify({"error": error}), 400
        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO public.jobs (
                    recruiter_id, title, company_name, location, category,
                    description, required_skills, min_salary, max_salary, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING """ + JOB_RETURNING,
                (
                    recruiter, data["title"], data["company_name"],
                    data["location"], data["category"], data["description"],
                    data["required_skills"], data["min_salary"],
                    data["max_salary"], data["status"],
                ),
            )
            row = cursor.fetchone()
            conn.commit()
            return jsonify({"message": "Job posting created successfully.", "job": _job_dict(row)}), 201
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Recruiter job creation failed")
            return jsonify({"error": "Unable to create job posting."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.get("/api/recruiter/jobs")
    def recruiter_list_jobs():
        recruiter, error = authorize()
        if error:
            return error
        paging, error = _pagination()
        if error:
            return jsonify({"error": error}), 400
        status = request.args.get("status")
        if status is not None and status not in JOB_STATUSES:
            return jsonify({"error": "Invalid job status filter."}), 400
        limit, offset = paging["limit"], paging["offset"]
        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            params = [recruiter]
            where = "WHERE recruiter_id = %s"
            if status is not None:
                where += " AND status = %s"
                params.append(status)
            params.extend((limit + 1, offset))
            cursor.execute(
                "SELECT " + JOB_RETURNING + " FROM public.jobs " + where +
                " ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s",
                tuple(params),
            )
            rows = cursor.fetchall()
            return jsonify({
                "jobs": [_job_dict(row) for row in rows[:limit]],
                "pagination": {"limit": limit, "offset": offset, "has_more": len(rows) > limit},
            }), 200
        except Exception:
            app.logger.exception("Recruiter job listing failed")
            return jsonify({"error": "Unable to retrieve job postings."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.get("/api/recruiter/jobs/<int:job_id>")
    def recruiter_get_job(job_id):
        recruiter, error = authorize()
        if error:
            return error
        if job_id < 1:
            return jsonify({"error": "Invalid job ID."}), 400
        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT " + JOB_RETURNING +
                " FROM public.jobs WHERE id = %s AND recruiter_id = %s",
                (job_id, recruiter),
            )
            row = cursor.fetchone()
            if row is None:
                return jsonify({"error": "Job posting not found."}), 404
            return jsonify({"job": _job_dict(row)}), 200
        except Exception:
            app.logger.exception("Recruiter job retrieval failed")
            return jsonify({"error": "Unable to retrieve job posting."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.patch("/api/recruiter/jobs/<int:job_id>")
    def recruiter_update_job(job_id):
        recruiter, error = authorize()
        if error:
            return error
        if job_id < 1:
            return jsonify({"error": "Invalid job ID."}), 400
        data, error = _validate_fields(request.get_json(silent=True), partial=True)
        if error:
            return jsonify({"error": error}), 400
        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            # Lock this recruiter's job so salary-bound validation is consistent
            # even when only one bound is being changed.
            cursor.execute(
                "SELECT min_salary, max_salary FROM public.jobs "
                "WHERE id = %s AND recruiter_id = %s FOR UPDATE",
                (job_id, recruiter),
            )
            row = cursor.fetchone()
            if row is None:
                conn.rollback()
                return jsonify({"error": "Job posting not found."}), 404
            minimum = data.get("min_salary", row[0])
            maximum = data.get("max_salary", row[1])
            if minimum is not None and maximum is not None and Decimal(str(minimum)) > Decimal(str(maximum)):
                conn.rollback()
                return jsonify({"error": "min_salary cannot exceed max_salary."}), 400
            # Column names originate exclusively from the fixed server-side
            # allowlist EDITABLE_FIELDS; values remain parameterized.
            fields = sorted(data)
            assignment = ", ".join(f"{field} = %s" for field in fields)
            cursor.execute(
                "UPDATE public.jobs SET " + assignment +
                " WHERE id = %s AND recruiter_id = %s RETURNING " + JOB_RETURNING,
                tuple(data[field] for field in fields) + (job_id, recruiter),
            )
            job = cursor.fetchone()
            if job is None:
                conn.rollback()
                return jsonify({"error": "Job posting not found."}), 404
            conn.commit()
            return jsonify({"message": "Job posting updated successfully.", "job": _job_dict(job)}), 200
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Recruiter job update failed")
            return jsonify({"error": "Unable to update job posting."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()
