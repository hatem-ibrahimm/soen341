from datetime import datetime, timezone
import uuid

from flask import jsonify, request


MAX_OPTIONS = 5
MAX_MESSAGE_LENGTH = 2000


def _uuid(value):
    try:
        return isinstance(value, str) and str(uuid.UUID(value)) == value.lower()
    except (ValueError, AttributeError):
        return False


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def register_interview_coordination_routes(app, get_connection, get_current_user):
    def application_participants(cursor, application_id):
        cursor.execute(
            """
            SELECT a.applicant_id, j.recruiter_id, j.title, j.company_name, a.status
            FROM public.applications AS a
            JOIN public.jobs AS j ON j.id = a.job_id
            WHERE a.id = %s
            """,
            (application_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "applicant_id": str(row[0]),
            "recruiter_id": str(row[1]),
            "job_title": row[2],
            "company": row[3],
            "status": row[4],
        }

    def authorize(application, user_id):
        if application is None or application["status"] != "Interview":
            return None
        if user_id == application["applicant_id"]:
            return "applicant"
        if user_id == application["recruiter_id"]:
            return "recruiter"
        return None

    def load_coordination(cursor, application_id):
        cursor.execute(
            """
            SELECT id, proposed_at, proposed_by, is_final, created_at
            FROM public.interview_options
            WHERE application_id = %s
            ORDER BY proposed_at, id
            """,
            (application_id,),
        )
        options = [
            {
                "id": str(row[0]),
                "proposed_at": _iso(row[1]),
                "proposed_by": str(row[2]),
                "is_final": row[3],
                "created_at": _iso(row[4]),
            }
            for row in cursor.fetchall()
        ]
        cursor.execute(
            """
            SELECT id, sender_id, message, created_at
            FROM public.interview_messages
            WHERE application_id = %s
            ORDER BY created_at, id
            """,
            (application_id,),
        )
        messages = [
            {
                "id": str(row[0]),
                "sender_id": str(row[1]),
                "message": row[2],
                "created_at": _iso(row[3]),
            }
            for row in cursor.fetchall()
        ]
        return options, messages

    @app.get("/api/applications/<application_id>/interview")
    def get_interview_coordination(application_id):
        if not _uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        user_id = str(getattr(user, "id", ""))
        if not _uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500
        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            application = application_participants(cursor, application_id)
            role = authorize(application, user_id)
            if role is None:
                return jsonify({"error": "Interview coordination not found."}), 404
            options, messages = load_coordination(cursor, application_id)
            return jsonify({
                "role": role,
                "job_title": application["job_title"],
                "company": application["company"],
                "options": options,
                "messages": messages,
            }), 200
        except Exception:
            app.logger.exception("Interview coordination retrieval failed")
            return jsonify({"error": "Unable to retrieve interview coordination."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.post("/api/applications/<application_id>/interview/options")
    def propose_interview_options(application_id):
        if not _uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        user_id = str(getattr(user, "id", ""))
        if not _uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500
        payload = request.get_json(silent=True)
        options = payload.get("options") if isinstance(payload, dict) else None
        if not isinstance(options, list) or not 2 <= len(options) <= MAX_OPTIONS:
            return jsonify({"error": f"Provide between 2 and {MAX_OPTIONS} interview options."}), 400
        parsed_options = []
        try:
            for value in options:
                if not isinstance(value, str):
                    raise ValueError
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if parsed.tzinfo is None or parsed <= datetime.now(timezone.utc):
                    raise ValueError
                parsed_options.append(parsed.astimezone(timezone.utc))
        except ValueError:
            return jsonify({"error": "Each option must be a future ISO 8601 datetime with a timezone."}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            application = application_participants(cursor, application_id)
            role = authorize(application, user_id)
            if role is None:
                conn.rollback()
                return jsonify({"error": "Interview coordination not found."}), 404
            if role != "applicant":
                conn.rollback()
                return jsonify({"error": "Only the job seeker can propose interview options."}), 403
            for proposed_at in parsed_options:
                cursor.execute(
                    """
                    INSERT INTO public.interview_options
                        (application_id, proposed_at, proposed_by)
                    VALUES (%s, %s, %s)
                    """,
                    (application_id, proposed_at, user_id),
                )
            cursor.execute(
                """
                INSERT INTO public.notifications (user_id, application_id, type, title, message)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    application["recruiter_id"],
                    application_id,
                    "interview_options",
                    "Interview times suggested",
                    "The job seeker suggested interview times for your review.",
                ),
            )
            conn.commit()
            return jsonify({"message": "Interview options submitted."}), 201
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Interview option submission failed")
            return jsonify({"error": "Unable to submit interview options."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.post("/api/applications/<application_id>/interview/messages")
    def send_interview_message(application_id):
        if not _uuid(application_id):
            return jsonify({"error": "Invalid application ID."}), 400
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        user_id = str(getattr(user, "id", ""))
        if not _uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500
        payload = request.get_json(silent=True)
        message = payload.get("message") if isinstance(payload, dict) else None
        if not isinstance(message, str) or not message.strip() or len(message.strip()) > MAX_MESSAGE_LENGTH:
            return jsonify({"error": f"Message must contain 1 to {MAX_MESSAGE_LENGTH} characters."}), 400

        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            application = application_participants(cursor, application_id)
            role = authorize(application, user_id)
            if role is None:
                conn.rollback()
                return jsonify({"error": "Interview coordination not found."}), 404
            recipient_id = application["recruiter_id"] if role == "applicant" else application["applicant_id"]
            cursor.execute(
                """
                INSERT INTO public.interview_messages (application_id, sender_id, message)
                VALUES (%s, %s, %s)
                RETURNING id, sender_id, message, created_at
                """,
                (application_id, user_id, message.strip()),
            )
            row = cursor.fetchone()
            cursor.execute(
                """
                INSERT INTO public.notifications (user_id, application_id, type, title, message)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    recipient_id,
                    application_id,
                    "interview_message",
                    "New interview message",
                    "You received a new message about interview scheduling.",
                ),
            )
            conn.commit()
            return jsonify({"message": {
                "id": str(row[0]),
                "sender_id": str(row[1]),
                "message": row[2],
                "created_at": _iso(row[3]),
            }}), 201
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Interview message submission failed")
            return jsonify({"error": "Unable to send interview message."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.patch("/api/applications/<application_id>/interview/options/<option_id>/final")
    def finalize_interview_option(application_id, option_id):
        if not _uuid(application_id) or not _uuid(option_id):
            return jsonify({"error": "Invalid interview option ID."}), 400
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        user_id = str(getattr(user, "id", ""))
        if not _uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500
        conn = cursor = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            application = application_participants(cursor, application_id)
            role = authorize(application, user_id)
            if role is None:
                conn.rollback()
                return jsonify({"error": "Interview coordination not found."}), 404
            if role != "recruiter":
                conn.rollback()
                return jsonify({"error": "Only the recruiter can confirm an interview time."}), 403
            cursor.execute(
                """
                SELECT id FROM public.interview_options
                WHERE id = %s AND application_id = %s
                FOR UPDATE
                """,
                (option_id, application_id),
            )
            if cursor.fetchone() is None:
                conn.rollback()
                return jsonify({"error": "Interview option not found."}), 404
            cursor.execute(
                "UPDATE public.interview_options SET is_final = FALSE WHERE application_id = %s",
                (application_id,),
            )
            cursor.execute(
                """
                UPDATE public.interview_options SET is_final = TRUE
                WHERE id = %s AND application_id = %s
                """,
                (option_id, application_id),
            )
            for recipient_id, title, message in (
                (
                    application["applicant_id"],
                    "Interview time confirmed",
                    "The recruiter confirmed an interview time. View the interview page for details.",
                ),
                (
                    application["recruiter_id"],
                    "Interview time confirmed",
                    "The final interview time was confirmed.",
                ),
            ):
                cursor.execute(
                    """
                    INSERT INTO public.notifications (user_id, application_id, type, title, message)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (recipient_id, application_id, "interview_final", title, message),
                )
            conn.commit()
            return jsonify({"message": "Interview time confirmed."}), 200
        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Interview time confirmation failed")
            return jsonify({"error": "Unable to confirm interview time."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()
