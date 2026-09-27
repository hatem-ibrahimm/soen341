import os
import re

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash

try:
    import psycopg2
    from psycopg2 import errors as pg_errors
except ImportError:
    psycopg2 = None
    pg_errors = None


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    app.config.from_mapping(
        DATABASE_URL=os.getenv("DATABASE_URL", ""),
        MIN_PASSWORD_LENGTH=int(os.getenv("MIN_PASSWORD_LENGTH", "8")),
    )

    if test_config:
        app.config.update(test_config)

    def get_connection():
        connection_factory = app.config.get("DB_CONNECTION_FACTORY")
        if connection_factory:
            return connection_factory()

        if psycopg2 is None:
            raise RuntimeError(
                "psycopg2 is not installed. Run: pip install -r backend/requirements.txt"
            )

        database_url = app.config.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is not configured.")

        return psycopg2.connect(database_url)

    @app.get("/")
    def home():
        return jsonify(
            {
                "service": "CareerConnect backend",
                "status": "running",
            }
        ), 200

    @app.post("/api/auth/register")
    def register():
        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

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

        password_hash = generate_password_hash(password)

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING email
                """,
                (email, password_hash),
            )
            created_user = cursor.fetchone()
            connection.commit()

            created_email = created_user[0] if created_user else email
            return jsonify(
                {
                    "message": "Account created successfully.",
                    "user": {"email": created_email},
                }
            ), 201

        except Exception as exc:
            if connection is not None:
                connection.rollback()

            # PostgreSQL unique_violation SQLSTATE = 23505.
            if getattr(exc, "pgcode", None) == "23505":
                return jsonify(
                    {"error": "An account with this email already exists."}
                ), 409

            app.logger.exception("Registration failed")
            return jsonify(
                {"error": "Unable to create account at this time."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @app.post("/api/profiles")
    def create_profile():
        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        required_fields = [
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "location",
            "bio",
        ]

        for field in required_fields:
            if not str(payload.get(field, "")).strip():
                return jsonify(
                    {"error": f"{field} is required."}
                ), 400

        first_name = str(payload["first_name"]).strip()
        last_name = str(payload["last_name"]).strip()
        email = str(payload["email"]).strip().lower()
        phone_number = str(payload["phone_number"]).strip()
        location = str(payload["location"]).strip()
        bio = str(payload["bio"]).strip()

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                INSERT INTO profiles
                    (first_name, last_name, email, phone_number, location, bio)
                VALUES
                    (%s, %s, %s, %s, %s, %s)
                RETURNING id, first_name, last_name, email,
                          phone_number, location, bio, created_at
                """,
                (
                    first_name,
                    last_name,
                    email,
                    phone_number,
                    location,
                    bio,
                ),
            )

            profile = cursor.fetchone()
            connection.commit()

            return jsonify(
                {
                    "message": "Profile created successfully.",
                    "profile": {
                        "id": profile[0],
                        "first_name": profile[1],
                        "last_name": profile[2],
                        "email": profile[3],
                        "phone_number": profile[4],
                        "location": profile[5],
                        "bio": profile[6],
                        "created_at": profile[7],
                    },
                }
            ), 201

        except Exception:
            if connection is not None:
                connection.rollback()

            app.logger.exception("Profile creation failed")
            return jsonify(
                {"error": "Unable to create profile at this time."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @app.get("/api/profiles/<int:profile_id>")
    def get_profile(profile_id):
        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, first_name, last_name, email,
                       phone_number, location, bio, created_at
                FROM profiles
                WHERE id = %s
                """,
                (profile_id,),
            )

            profile = cursor.fetchone()

            if profile is None:
                return jsonify({"error": "Profile not found."}), 404

            return jsonify(
                {
                    "profile": {
                        "id": profile[0],
                        "first_name": profile[1],
                        "last_name": profile[2],
                        "email": profile[3],
                        "phone_number": profile[4],
                        "location": profile[5],
                        "bio": profile[6],
                        "created_at": profile[7],
                    }
                }
            ), 200

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
                
    @app.put("/api/profiles/<int:profile_id>")
    def update_profile(profile_id):
        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        required_fields = [
            "first_name",
            "last_name",
            "email",
            "phone_number",
            "location",
            "bio",
        ]

        for field in required_fields:
            if not str(payload.get(field, "")).strip():
                return jsonify({"error": f"{field} is required."}), 400

        first_name = str(payload["first_name"]).strip()
        last_name = str(payload["last_name"]).strip()
        email = str(payload["email"]).strip().lower()
        phone_number = str(payload["phone_number"]).strip()
        location = str(payload["location"]).strip()
        bio = str(payload["bio"]).strip()

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                UPDATE profiles
                SET first_name = %s,
                    last_name = %s,
                    email = %s,
                    phone_number = %s,
                    location = %s,
                    bio = %s
                WHERE id = %s
                RETURNING id, first_name, last_name, email,
                          phone_number, location, bio, created_at
                """,
                (
                    first_name,
                    last_name,
                    email,
                    phone_number,
                    location,
                    bio,
                    profile_id,
                ),
            )

            profile = cursor.fetchone()

            if profile is None:
                connection.rollback()
                return jsonify({"error": "Profile not found."}), 404

            connection.commit()

            return jsonify(
                {
                    "message": "Profile updated successfully.",
                    "profile": {
                        "id": profile[0],
                        "first_name": profile[1],
                        "last_name": profile[2],
                        "email": profile[3],
                        "phone_number": profile[4],
                        "location": profile[5],
                        "bio": profile[6],
                        "created_at": profile[7],
                    },
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