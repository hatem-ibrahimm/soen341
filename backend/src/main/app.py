import os
import re
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

try:
    import psycopg2
except ImportError:
    psycopg2 = None

try:
    import jwt
except ImportError:
    jwt = None


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    app.config.from_mapping(
        DATABASE_URL=os.getenv("DATABASE_URL", ""),
        JWT_SECRET=os.getenv("JWT_SECRET", "change-me-in-local-env"),
        MIN_PASSWORD_LENGTH=int(os.getenv("MIN_PASSWORD_LENGTH", "8")),
    )
    if test_config:
        app.config.update(test_config)

    def get_connection():
        factory = app.config.get("DB_CONNECTION_FACTORY")
        if factory:
            return factory()
        if psycopg2 is None:
            raise RuntimeError("psycopg2 is not installed.")
        if not app.config["DATABASE_URL"]:
            raise RuntimeError("DATABASE_URL is not configured.")
        return psycopg2.connect(app.config["DATABASE_URL"])

    def make_token(email):
        if jwt is None:
            raise RuntimeError("PyJWT is not installed.")
        token = jwt.encode(
            {"sub": email},
            app.config["JWT_SECRET"],
            algorithm="HS256",
        )
        return token.decode("utf-8") if isinstance(token, bytes) else token

    def require_auth(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify({"error": "Authentication required."}), 401
            token = header.removeprefix("Bearer ").strip()
            try:
                payload = jwt.decode(
                    token,
                    app.config["JWT_SECRET"],
                    algorithms=["HS256"],
                )
            except Exception:
                return jsonify({"error": "Invalid authentication token."}), 401
            request.auth_email = payload.get("sub")
            return view(*args, **kwargs)
        return wrapped

    @app.get("/")
    def home():
        return jsonify({"service": "CareerConnect backend", "status": "running"}), 200

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
            return jsonify({
                "error": f"Password must be at least {app.config['MIN_PASSWORD_LENGTH']} characters long."
            }), 400

        connection = cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(
                """
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                RETURNING email
                """,
                (email, generate_password_hash(password)),
            )
            row = cursor.fetchone()
            connection.commit()
            return jsonify({
                "message": "Account created successfully.",
                "user": {"email": row[0] if row else email},
            }), 201
        except Exception as exc:
            if connection:
                connection.rollback()
            if getattr(exc, "pgcode", None) == "23505":
                return jsonify({"error": "An account with this email already exists."}), 409
            app.logger.exception("Registration failed")
            return jsonify({"error": "Unable to create account at this time."}), 500
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))
        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        connection = cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(
                "SELECT email, password_hash FROM users WHERE email = %s",
                (email,),
            )
            row = cursor.fetchone()

            if not row or not check_password_hash(row[1], password):
                return jsonify({"error": "Invalid email or password."}), 401

            return jsonify({
                "message": "Login successful.",
                "token": make_token(row[0]),
                "user": {"email": row[0]},
            }), 200
        except Exception:
            app.logger.exception("Login failed")
            return jsonify({"error": "Unable to log in at this time."}), 500
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    @app.get("/api/auth/me")
    @require_auth
    def me():
        return jsonify({"user": {"email": request.auth_email}}), 200

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
