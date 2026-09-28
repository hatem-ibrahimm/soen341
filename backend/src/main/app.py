import os
import re

from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client

try:
    import psycopg2
except ImportError:
    psycopg2 = None


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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

    def get_authenticated_user():
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            return None

        access_token = authorization.removeprefix("Bearer ").strip()
        if not access_token:
            return None

        try:
            response = get_supabase().auth.get_user(access_token)
        except Exception:
            return None

        return getattr(response, "user", None)

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
                    "options": {
                        "data": {
                            "first_name": str(payload.get("firstName", "")).strip(),
                            "last_name": str(payload.get("lastName", "")).strip(),
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
                return jsonify(
                    {"error": "Invalid authentication token."}
                ), 401

            return jsonify(
                {
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                    }
                }
            ), 200

        except Exception:
            return jsonify(
                {"error": "Invalid authentication token."}
            ), 401

    # -------------------------
    # Profile Management - US-02
    # -------------------------

    @app.get("/api/profiles/me")
    def get_profile():
        user = get_authenticated_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(
                """
                SELECT id, first_name, last_name, email, title,
                    phone_number, location, bio, created_at
                FROM profiles
                WHERE id = %s
                """,
                (str(user.id),),
            )
            profile = cursor.fetchone()

            if profile is None:
                return jsonify({"error": "Profile not found."}), 404

            cursor.execute(
                """
                SELECT job_title, company, dates, description
                FROM work_experiences
                WHERE user_id = %s
                ORDER BY display_order, created_at
                """,
                (str(user.id),),
            )
            experiences = cursor.fetchall()
            cursor.execute(
                """
                SELECT school, degree, years
                FROM education
                WHERE user_id = %s
                ORDER BY display_order, created_at
                """,
                (str(user.id),),
            )
            education = cursor.fetchall()
            cursor.execute(
                """
                SELECT name
                FROM skills
                WHERE user_id = %s
                ORDER BY created_at
                """,
                (str(user.id),),
            )
            skills = cursor.fetchall()

            return jsonify(
                {
                    "profile": {
                        "id": str(profile[0]),
                        "first_name": profile[1],
                        "last_name": profile[2],
                        "email": profile[3],
                        "title": profile[4],
                        "phone_number": profile[5],
                        "location": profile[6],
                        "bio": profile[7],
                        "created_at": profile[8],
                        "experiences": [
                            {
                                "title": experience[0],
                                "company": experience[1],
                                "dates": experience[2],
                                "description": experience[3],
                            }
                            for experience in experiences
                        ],
                        "education": [
                            {
                                "school": item[0],
                                "degree": item[1],
                                "years": item[2],
                            }
                            for item in education
                        ],
                        "skills": [item[0] for item in skills],
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

    @app.put("/api/profiles/me")
    def save_profile():
        user = get_authenticated_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401

        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify(
                {"error": "Request body must be valid JSON."}
            ), 400

        list_fields = ("experiences", "education", "skills")
        for field in list_fields:
            if field in payload and not isinstance(payload[field], list):
                return jsonify({"error": f"{field} must be a list."}), 400
        if any(
            not isinstance(item, dict)
            for field in ("experiences", "education")
            for item in payload.get(field, [])
        ):
            return jsonify(
                {"error": "Experience and education entries must be objects."}
            ), 400
        if any(
            not isinstance(skill, str) or not skill.strip()
            for skill in payload.get("skills", [])
        ):
            return jsonify(
                {"error": "Skills must contain non-empty strings."}
            ), 400
        normalized_skills = [
            skill.strip().lower() for skill in payload.get("skills", [])
        ]
        if len(normalized_skills) != len(set(normalized_skills)):
            return jsonify({"error": "Skills must not contain duplicates."}), 400

        required_fields = [
            "first_name",
            "last_name",
            "email",
            "title",
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
        title = str(payload["title"]).strip()
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
                    (
                        id,
                        first_name,
                        last_name,
                        email,
                        title,
                        phone_number,
                        location,
                        bio
                    )
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE
                SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    title = EXCLUDED.title,
                    phone_number = EXCLUDED.phone_number,
                    location = EXCLUDED.location,
                    bio = EXCLUDED.bio
                RETURNING
                    id,
                    first_name,
                    last_name,
                    email,
                    title,
                    phone_number,
                    location,
                    bio,
                    created_at
                """,
                (
                    str(user.id),
                    first_name,
                    last_name,
                    email,
                    title,
                    phone_number,
                    location,
                    bio,
                ),
            )

            profile = cursor.fetchone()
            user_id = str(user.id)

            cursor.execute(
                "DELETE FROM work_experiences WHERE user_id = %s",
                (user_id,),
            )
            for index, experience in enumerate(payload.get("experiences", [])):
                cursor.execute(
                    """
                    INSERT INTO work_experiences
                        (user_id, job_title, company, dates, description, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        str(experience.get("title", "")).strip(),
                        str(experience.get("company", "")).strip(),
                        str(experience.get("dates", "")).strip(),
                        str(experience.get("description", "")).strip(),
                        index,
                    ),
                )

            cursor.execute("DELETE FROM education WHERE user_id = %s", (user_id,))
            for index, item in enumerate(payload.get("education", [])):
                cursor.execute(
                    """
                    INSERT INTO education (user_id, school, degree, years, display_order)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        str(item.get("school", "")).strip(),
                        str(item.get("degree", "")).strip(),
                        str(item.get("years", "")).strip(),
                        index,
                    ),
                )

            cursor.execute("DELETE FROM skills WHERE user_id = %s", (user_id,))
            for skill in payload.get("skills", []):
                cursor.execute(
                    "INSERT INTO skills (user_id, name) VALUES (%s, %s)",
                    (user_id, skill.strip()),
                )

            connection.commit()

            return jsonify(
                {
                    "message": "Profile saved successfully.",
                    "profile": {
                        "id": str(profile[0]),
                        "first_name": profile[1],
                        "last_name": profile[2],
                        "email": profile[3],
                        "title": profile[4],
                        "phone_number": profile[5],
                        "location": profile[6],
                        "bio": profile[7],
                        "created_at": profile[8],
                    },
                }
            ), 200

        except Exception:
            if connection is not None:
                connection.rollback()

            app.logger.exception("Profile save failed")

            return jsonify(
                {"error": "Unable to create profile at this time."}
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