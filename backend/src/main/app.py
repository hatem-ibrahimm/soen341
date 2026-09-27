import os
import re

from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    app.config.from_mapping(
        SUPABASE_URL=os.getenv("SUPABASE_URL", ""),
        SUPABASE_KEY=os.getenv("SUPABASE_KEY", ""),
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

        try:
            supabase = get_supabase()
            response = supabase.auth.sign_up(
                {
                    "email": email,
                    "password": password,
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

            app.logger.warning("Supabase registration failed: %s", message)
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

            app.logger.warning("Supabase login failed: %s", message)
            return jsonify({"error": "Unable to log in."}), 400

    @app.get("/api/auth/me")
    def me():
        authorization = request.headers.get("Authorization", "")

        if not authorization.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401

        access_token = authorization.removeprefix("Bearer ").strip()

        if not access_token:
            return jsonify({"error": "Authentication required."}), 401

        try:
            supabase = get_supabase()
            response = supabase.auth.get_user(access_token)
            user = getattr(response, "user", None)

            if user is None:
                return jsonify({"error": "Invalid authentication token."}), 401

            return jsonify(
                {
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                    }
                }
            ), 200

        except Exception:
            return jsonify({"error": "Invalid authentication token."}), 401

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
