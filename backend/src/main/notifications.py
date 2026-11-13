
import uuid

from flask import jsonify


def valid_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def register_notification_routes(app, get_connection, get_current_user):
    """Register notification endpoints."""

    @app.get("/api/notifications")
    def get_notifications():
        """Retrieve notifications belonging to the logged-in user."""
        user = get_current_user()

        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        user_id = str(user.id)
        if not valid_uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500

        conn = None
        cursor = None

        try:
            conn = get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT id, application_id, type, title,
                       message, is_read, created_at
                FROM notifications
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (user_id,),
            )

            notifications = []

            for row in cursor.fetchall():
                notifications.append({
                    "id": str(row[0]),
                    "application_id": str(row[1]) if row[1] else None,
                    "type": row[2],
                    "title": row[3],
                    "message": row[4],
                    "is_read": row[5],
                    "created_at": row[6].isoformat(),
                })

            return jsonify({"notifications": notifications}), 200

        except Exception:
            app.logger.exception("Notification retrieval failed")
            return jsonify({"error": "Unable to retrieve notifications."}), 500

        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.get("/api/notifications/unread-count")
    def get_unread_count():
        """Count unread notifications for the logged-in user."""
        user = get_current_user()

        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        user_id = str(user.id)
        if not valid_uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500

        conn = None
        cursor = None

        try:
            conn = get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM notifications
                WHERE user_id = %s AND is_read = FALSE
                """,
                (user_id,),
            )

            count = cursor.fetchone()[0]

            return jsonify({"unread_count": count}), 200

        except Exception:
            app.logger.exception("Unread notification count failed")
            return jsonify({"error": "Unable to count notifications."}), 500

        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    @app.patch("/api/notifications/<notification_id>/read")
    def mark_notification_read(notification_id):
        """Mark one of the logged-in user's notifications as read."""
        user = get_current_user()

        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        if not valid_uuid(notification_id):
            return jsonify({"error": "Invalid notification ID."}), 400

        user_id = str(user.id)
        if not valid_uuid(user_id):
            return jsonify({"error": "Invalid user ID."}), 500

        conn = None
        cursor = None

        try:
            conn = get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                UPDATE notifications
                SET is_read = TRUE
                WHERE id = %s AND user_id = %s
                RETURNING id
                """,
                (notification_id, user_id),
            )

            if cursor.fetchone() is None:
                conn.rollback()
                return jsonify({"error": "Notification not found."}), 404

            conn.commit()

            return jsonify({
                "message": "Notification marked as read."
            }), 200

        except Exception:
            if conn is not None:
                conn.rollback()
            app.logger.exception("Notification update failed")
            return jsonify({"error": "Unable to update notification."}), 500

        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()