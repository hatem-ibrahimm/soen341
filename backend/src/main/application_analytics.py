"""Job seeker application analytics for Sprint 3 Issue #79.

This is intentionally read-only. Authentication comes from the existing
Supabase Auth helper; the applicant ID is never accepted from the caller.
"""

import uuid

from flask import jsonify


APPLICATION_STATUSES = (
    "Applied",
    "Under Review",
    "Interview",
    "Offered",
    "Rejected",
)


# One parameterized query for every dashboard count. PostgreSQL COUNT(*)
# returns zero for empty sets, so no extra empty-data handling is needed.
APPLICATION_COUNTS_SQL = """
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'Applied'),
        COUNT(*) FILTER (WHERE status = 'Under Review'),
        COUNT(*) FILTER (WHERE status = 'Interview'),
        COUNT(*) FILTER (WHERE status = 'Offered'),
        COUNT(*) FILTER (WHERE status = 'Rejected')
    FROM public.applications
    WHERE applicant_id = %s
"""


def register_application_analytics_routes(app, get_connection, get_current_user):
    """Register the current job seeker's read-only application statistics."""

    @app.get("/api/analytics/applications")
    def get_my_application_analytics():
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        try:
            applicant_id = str(uuid.UUID(str(user.id)))
        except (AttributeError, TypeError, ValueError):
            app.logger.error("Authenticated user ID is not a valid UUID")
            return jsonify({"error": "Unable to retrieve application analytics."}), 500

        connection = None
        cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(APPLICATION_COUNTS_SQL, (applicant_id,))
            counts = cursor.fetchone()

            if counts is None or len(counts) != len(APPLICATION_STATUSES) + 1:
                raise ValueError("Unexpected application analytics result")
            if any(
                not isinstance(value, int) or isinstance(value, bool) or value < 0
                for value in counts
            ):
                raise ValueError("Invalid application analytics count")
            total = counts[0]
            by_status = dict(zip(APPLICATION_STATUSES, counts[1:]))
            if sum(by_status.values()) != total:
                # The deployed schema constrains status to these five values.
                # Fail rather than silently returning inconsistent statistics.
                raise ValueError("Application statuses do not match the expected schema")

            return jsonify({
                "total_applications": total,
                "by_status": by_status,
            }), 200

        except Exception:
            app.logger.exception("Application analytics retrieval failed")
            return jsonify({"error": "Unable to retrieve application analytics."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()
