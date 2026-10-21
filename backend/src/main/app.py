import os
import re
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client

try:
    import psycopg2
except ImportError:
    psycopg2 = None


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Columns returned for a profile, in this order
PROFILE_COLUMNS = [
    "id",
    "first_name",
    "last_name",
    "title",
    "email",
    "phone_number",
    "location",
    "bio",
    "created_at",
    "updated_at",
]


def profile_to_dict(row):
    """Turn a database row into a dictionary using PROFILE_COLUMNS."""
    profile = dict(zip(PROFILE_COLUMNS, row))
    profile["id"] = str(profile["id"])
    return profile


def is_valid_uuid(value):
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    app.config.from_mapping(
        SUPABASE_URL=os.getenv("SUPABASE_URL", ""),
        SUPABASE_KEY=os.getenv("SUPABASE_KEY", ""),
        DATABASE_URL=os.getenv("DATABASE_URL", ""),
        MIN_PASSWORD_LENGTH=int(os.getenv("MIN_PASSWORD_LENGTH", "8")),
    )

    if test_config:
        app.config.update(test_config)

    def get_supabase():
        factory = app.config.get("SUPABASE_CLIENT_FACTORY")

        if factory:
            return factory()

        if not app.config["SUPABASE_URL"] or not app.config["SUPABASE_KEY"]:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be configured."
            )

        return create_client(
            app.config["SUPABASE_URL"],
            app.config["SUPABASE_KEY"],
        )

    def get_connection():
        factory = app.config.get("DB_CONNECTION_FACTORY")

        if factory:
            return factory()

        if psycopg2 is None:
            raise RuntimeError("psycopg2 is not installed.")

        if not app.config["DATABASE_URL"]:
            raise RuntimeError("DATABASE_URL must be configured.")

        return psycopg2.connect(app.config["DATABASE_URL"])

    def get_current_user():
        """
        Read the "Authorization: Bearer <token>" header and ask Supabase
        which user the token belongs to. Returns the user, or None if the
        header is missing or the token is not valid.
        """
        authorization = request.headers.get("Authorization", "")

        if not authorization.startswith("Bearer "):
            return None

        access_token = authorization.removeprefix("Bearer ").strip()

        if not access_token:
            return None

        try:
            supabase = get_supabase()
            response = supabase.auth.get_user(access_token)
            return getattr(response, "user", None)
        except Exception:
            return None

    def check_profile_access(profile_id):
        """
        Make sure the logged-in user is asking for their OWN profile.
        Returns an error response to send back, or None if access is allowed.
        """
        if not is_valid_uuid(profile_id):
            return jsonify({"error": "Profile not found."}), 404

        user = get_current_user()

        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        if str(user.id).lower() != str(profile_id).lower():
            return jsonify(
                {"error": "You can only access your own profile."}
            ), 403

        return None

    # -------------------------
    # Home
    # -------------------------

    @app.get("/")
    def home():
        return jsonify(
            {
                "service": "CareerConnect backend",
                "status": "running",
            }
        ), 200

    # -------------------------
    # Authentication
    # -------------------------

    @app.post("/api/auth/register")
    def register():
        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        first_name = str(payload.get("first_name", "")).strip()
        last_name = str(payload.get("last_name", "")).strip()

        # The registration form may send one "name" field instead,
        # e.g. "Ace Newton" -> first_name "Ace", last_name "Newton"
        if not first_name and not last_name:
            full_name = str(payload.get("name", "")).strip()
            if full_name:
                parts = full_name.split(" ", 1)
                first_name = parts[0]
                last_name = parts[1].strip() if len(parts) > 1 else ""

        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        if not EMAIL_PATTERN.fullmatch(email):
            return jsonify({"error": "A valid email address is required."}), 400

        if len(password) < app.config["MIN_PASSWORD_LENGTH"]:
            return jsonify(
                {
                    "error": (
                        f"Password must be at least "
                        f"{app.config['MIN_PASSWORD_LENGTH']} characters long."
                    )
                }
            ), 400

        try:
            supabase = get_supabase()

            # "data" is saved as user metadata. The database trigger
            # (handle_new_user) copies first_name and last_name from it
            # into the new row in the profiles table.
            response = supabase.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {
                        "data": {
                            "first_name": first_name,
                            "last_name": last_name,
                        }
                    },
                }
            )

            user = getattr(response, "user", None)
            session = getattr(response, "session", None)

            if user is None:
                return jsonify({"error": "Unable to create account."}), 400

            body = {
                "message": (
                    "Account created successfully."
                    if session is not None
                    else "Account created. Check your email to confirm your account."
                ),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                },
                "email_confirmation_required": session is None,
            }

            if session is not None:
                body["session"] = {
                    "access_token": session.access_token,
                    "refresh_token": session.refresh_token,
                }

            return jsonify(body), 201

        except Exception as exc:
            message = str(exc)
            lowered = message.lower()

            if (
                "already registered" in lowered
                or "already exists" in lowered
                or "user already" in lowered
            ):
                return jsonify(
                    {"error": "An account with this email already exists."}
                ), 409

            app.logger.warning(
                "Supabase registration failed: %s",
                message,
            )

            return jsonify({"error": "Unable to create account."}), 400

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        try:
            supabase = get_supabase()

            response = supabase.auth.sign_in_with_password(
                {
                    "email": email,
                    "password": password,
                }
            )

            user = getattr(response, "user", None)
            session = getattr(response, "session", None)

            if user is None or session is None:
                return jsonify({"error": "Invalid email or password."}), 401

            return jsonify(
                {
                    "message": "Login successful.",
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                    },
                    "session": {
                        "access_token": session.access_token,
                        "refresh_token": session.refresh_token,
                    },
                }
            ), 200

        except Exception as exc:
            message = str(exc)
            lowered = message.lower()

            if (
                "invalid login credentials" in lowered
                or "email not confirmed" in lowered
                or "invalid credentials" in lowered
            ):
                return jsonify({"error": "Invalid email or password."}), 401

            app.logger.warning(
                "Supabase login failed: %s",
                message,
            )

            return jsonify({"error": "Unable to log in."}), 400

    @app.get("/api/auth/me")
    def me():
        user = get_current_user()

        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        return jsonify(
            {
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                }
            }
        ), 200

    # -------------------------
    # Profile Management - US-02
    # -------------------------
    # A profile row is created automatically by the database trigger
    # (handle_new_user) when someone registers, and its id is the same
    # as the user's Supabase id. So there is no "create profile" route:
    # the frontend only reads (GET) and updates (PUT) it.

    @app.get("/api/profiles/<profile_id>")
    def get_profile(profile_id):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                f"""
                SELECT {", ".join(PROFILE_COLUMNS)}
                FROM profiles
                WHERE id = %s
                """,
                (profile_id,),
            )

            row = cursor.fetchone()

            if row is None:
                return jsonify(
                    {"error": "Profile not found."}
                ), 404

            return jsonify({"profile": profile_to_dict(row)}), 200

        except Exception:
            app.logger.exception("Profile retrieval failed")

            return jsonify(
                {"error": "Unable to retrieve profile at this time."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()

            if connection is not None:
                connection.close()

    @app.put("/api/profiles/<profile_id>")
    def update_profile(profile_id):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error

        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify(
                {"error": "Request body must be valid JSON."}
            ), 400

        # Only these are required. The rest can be left empty,
        # since a new user will not have filled them in yet.
        required_fields = ["first_name", "last_name", "email"]

        for field in required_fields:
            if not str(payload.get(field) or "").strip():
                return jsonify(
                    {"error": f"{field} is required."}
                ), 400

        email = str(payload["email"]).strip().lower()

        if not EMAIL_PATTERN.fullmatch(email):
            return jsonify({"error": "A valid email address is required."}), 400

        def optional(field):
            # Empty text is saved as NULL (no value) in the database
            value = str(payload.get(field) or "").strip()
            return value or None

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                f"""
                UPDATE profiles
                SET
                    first_name = %s,
                    last_name = %s,
                    title = %s,
                    email = %s,
                    phone_number = %s,
                    location = %s,
                    bio = %s
                WHERE id = %s
                RETURNING {", ".join(PROFILE_COLUMNS)}
                """,
                (
                    str(payload["first_name"]).strip(),
                    str(payload["last_name"]).strip(),
                    optional("title"),
                    email,
                    optional("phone_number"),
                    optional("location"),
                    optional("bio"),
                    profile_id,
                ),
            )

            row = cursor.fetchone()

            if row is None:
                connection.rollback()

                return jsonify(
                    {"error": "Profile not found."}
                ), 404

            connection.commit()

            return jsonify(
                {
                    "message": "Profile updated successfully.",
                    "profile": profile_to_dict(row),
                }
            ), 200

        except Exception:
            if connection is not None:
                connection.rollback()

            app.logger.exception("Profile update failed")

            return jsonify(
                {"error": "Unable to update profile at this time."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()

            if connection is not None:
                connection.close()

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )