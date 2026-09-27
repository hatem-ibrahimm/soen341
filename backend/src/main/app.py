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

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
