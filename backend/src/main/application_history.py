"""Sprint 3 Issue #80: authenticated job-application history and activity.

Read-only API: application ownership comes exclusively from the Supabase-authenticated
user, never from an applicant ID supplied by the browser. Dates are interpreted in UTC.
"""

import re
import uuid
from datetime import date, datetime, time, timedelta, timezone

from flask import jsonify, request


APPLICATION_STATUSES = frozenset(
    ("Applied", "Under Review", "Interview", "Offered", "Rejected")
)
DEFAULT_LIMIT = 20
MAX_LIMIT = 100
MAX_OFFSET = 100_000
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}\Z")


def _authenticated_applicant_id(get_current_user):
    """Return the canonical Supabase UUID, or None if the token is invalid."""
    user = get_current_user()
    if user is None:
        return None, None
    try:
        return str(uuid.UUID(str(user.id))), None
    except (AttributeError, TypeError, ValueError):
        return None, "invalid_user_id"


def _read_date(name):
    raw = request.args.get(name)
    if raw is None:
        return None, None
    if not DATE_PATTERN.fullmatch(raw):
        return None, f"{name} must use YYYY-MM-DD format."
    try:
        return date.fromisoformat(raw), None
    except ValueError:
        return None, f"{name} must be a valid calendar date."


def _date_filters():
    """Inclusive UTC date range; SQL compares against half-open time bounds."""
    start_date, error = _read_date("start_date")
    if error:
        return None, error
    end_date, error = _read_date("end_date")
    if error:
        return None, error
    if start_date and end_date and start_date > end_date:
        return None, "start_date cannot be after end_date."
    if end_date == date.max:
        return None, "end_date is outside the supported range."
    return (start_date, end_date), None


def _parse_pagination(name, default, minimum, maximum):
    raw = request.args.get(name)
    if raw is None:
        return default, None
    if not raw.isascii() or not raw.isdecimal():
        return None, f"{name} must be an integer from {minimum} to {maximum}."
    number = int(raw)
    if not minimum <= number <= maximum:
        return None, f"{name} must be an integer from {minimum} to {maximum}."
    return number, None


def _apply_date_filters(clauses, params, dates):
    start_date, end_date = dates
    if start_date:
        clauses.append("a.created_at >= %s")
        params.append(datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date:
        clauses.append("a.created_at < %s")
        params.append(
            datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )


def _iso_datetime(value):
    if not isinstance(value, (datetime, str)):
        raise ValueError("Unexpected application timestamp")
    return value.isoformat() if isinstance(value, datetime) else value


def _history_record(row):
    if len(row) != 6 or row[0] is None or row[1] is None:
        raise ValueError("Unexpected application history row")
    return {
        "id": str(row[0]),
        "job_id": row[1],
        "job_title": row[2],
        "company_name": row[3],
        "status": row[4],
        "submitted_at": _iso_datetime(row[5]),
    }


def _activity_record(row):
    if len(row) != 2:
        raise ValueError("Unexpected activity row")
    period_start, count = row
    if isinstance(period_start, datetime):
        period_start = period_start.date()
    if not isinstance(period_start, date):
        raise ValueError("Unexpected period date")
    if not isinstance(count, int) or isinstance(count, bool) or count < 0:
        raise ValueError("Unexpected application count")
    return {"period_start": period_start.isoformat(), "applications": count}


def register_application_history_routes(app, get_connection, get_current_user):
    """Register the two read-only applicant-scoped history endpoints."""

    @app.get("/api/analytics/applications/history")
    def get_my_application_history():
        applicant_id, error = _authenticated_applicant_id(get_current_user)
        if applicant_id is None:
            if error:
                app.logger.error("Authenticated user ID is not a valid UUID")
                return jsonify({"error": "Unable to retrieve application history."}), 500
            return jsonify({"error": "Authentication required."}), 401

        dates, error = _date_filters()
        if error:
            return jsonify({"error": error}), 400

        status = request.args.get("status")
        if status is not None and status not in APPLICATION_STATUSES:
            return jsonify({"error": "Invalid application status filter."}), 400
        limit, error = _parse_pagination("limit", DEFAULT_LIMIT, 1, MAX_LIMIT)
        if error:
            return jsonify({"error": error}), 400
        offset, error = _parse_pagination("offset", 0, 0, MAX_OFFSET)
        if error:
            return jsonify({"error": error}), 400

        clauses = ["a.applicant_id = %s"]
        params = [applicant_id]
        _apply_date_filters(clauses, params, dates)
        if status is not None:
            clauses.append("a.status = %s")
            params.append(status)

        sql = """
            SELECT a.id, a.job_id, j.title, j.company_name,
                   a.status, a.created_at
            FROM public.applications AS a
            JOIN public.jobs AS j ON j.id = a.job_id
            WHERE {where}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT %s OFFSET %s
        """.format(where=" AND ".join(clauses))
        params.extend((limit + 1, offset))

        connection = None
        cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall()
            has_more = len(rows) > limit
            history = [_history_record(row) for row in rows[:limit]]
            return jsonify({
                "history": history,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "has_more": has_more,
                },
            }), 200
        except Exception:
            app.logger.exception("Application history retrieval failed")
            return jsonify({"error": "Unable to retrieve application history."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @app.get("/api/analytics/applications/activity")
    def get_my_application_activity():
        applicant_id, error = _authenticated_applicant_id(get_current_user)
        if applicant_id is None:
            if error:
                app.logger.error("Authenticated user ID is not a valid UUID")
                return jsonify({"error": "Unable to retrieve application activity."}), 500
            return jsonify({"error": "Authentication required."}), 401

        dates, error = _date_filters()
        if error:
            return jsonify({"error": error}), 400
        group_by = request.args.get("group_by", "month")
        if group_by not in ("week", "month"):
            return jsonify({"error": "group_by must be week or month."}), 400

        clauses = ["a.applicant_id = %s"]
        params = [applicant_id]
        _apply_date_filters(clauses, params, dates)

        # group_by is an explicit allowlist, never an arbitrary SQL fragment.
        sql = """
            SELECT date_trunc(%s, a.created_at AT TIME ZONE 'UTC')::date
                   AS period_start,
                   COUNT(*) AS applications
            FROM public.applications AS a
            WHERE {where}
            GROUP BY 1
            ORDER BY 1 ASC
        """.format(where=" AND ".join(clauses))
        # The date_trunc interval is parameterized like any other user input.
        params.insert(0, group_by)

        connection = None
        cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(sql, tuple(params))
            periods = [_activity_record(row) for row in cursor.fetchall()]
            total = sum(row["applications"] for row in periods)
            return jsonify({
                "group_by": group_by,
                "total_applications": total,
                "periods": periods,
            }), 200
        except Exception:
            app.logger.exception("Application activity retrieval failed")
            return jsonify({"error": "Unable to retrieve application activity."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()
