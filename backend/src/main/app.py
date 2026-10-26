import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from supabase import create_client
from werkzeug.utils import secure_filename
from werkzeug.utils import secure_filename

try:
    import psycopg2
except ImportError:
    psycopg2 = None


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

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
        SUPABASE_SERVICE_KEY=os.getenv("SUPABASE_SERVICE_KEY", ""),
        DATABASE_URL=os.getenv("DATABASE_URL", ""),
        MIN_PASSWORD_LENGTH=int(os.getenv("MIN_PASSWORD_LENGTH", "8")),
        RESUME_BUCKET=os.getenv("SUPABASE_RESUME_BUCKET", "resumes"),
        RESUME_MAX_SIZE=10 * 1024 * 1024,  # 10 MB
        RESUME_SIGNED_URL_SECONDS=3600,    # 1 hour
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

    def get_storage_supabase():
        factory = app.config.get("SUPABASE_CLIENT_FACTORY")

        if factory:
            return factory()

        service_key = app.config.get("SUPABASE_SERVICE_KEY")

        if not service_key:
            return get_supabase()

        if not app.config["SUPABASE_URL"]:
            raise RuntimeError("SUPABASE_URL must be configured.")

        return create_client(app.config["SUPABASE_URL"], service_key)

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
    # Profile Management
    # A profile row is created automatically by the database trigger (handle_new_user) when someone registers, and its id is the same
    # as the user's Supabase id. So there is no "create profile" route: the frontend only reads (GET) and updates (PUT) it.

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


    # -------------------------
    # Profile Picture Management
    # -------------------------

    MAX_PICTURE_SIZE = 2 * 1024 * 1024  # 2 MB
    PICTURE_BUCKET = "profile-pictures"

    def validate_picture(file):
        """Validate the uploaded profile picture."""
        if not file or not file.filename:
            return None, None, "A profile picture is required."

        filename = secure_filename(file.filename)
        extension = os.path.splitext(filename)[1].lower()

        if extension not in {".jpg", ".jpeg", ".png"}:
            return None, None, "Only JPG, JPEG, and PNG images are allowed."

        image_bytes = file.stream.read(MAX_PICTURE_SIZE + 1)

        if not image_bytes:
            return None, None, "The uploaded image is empty."

        if len(image_bytes) > MAX_PICTURE_SIZE:
            return None, None, "The image must be 2 MB or smaller."

        if image_bytes.startswith(b"\xff\xd8\xff"):
            content_type = "image/jpeg"
        elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            content_type = "image/png"
        else:
            return None, None, "The uploaded file is not a valid JPG or PNG image."

        if extension == ".png" and content_type != "image/png":
            return None, None, "The file extension does not match the image."

        if extension in {".jpg", ".jpeg"} and content_type != "image/jpeg":
            return None, None, "The file extension does not match the image."

        return image_bytes, content_type, None

    @app.post("/api/profiles/<profile_id>/picture")
    @app.put("/api/profiles/<profile_id>/picture")
    def upload_profile_picture(profile_id):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error

        image_bytes, content_type, error = validate_picture(
            request.files.get("picture")
        )

        if error:
            return jsonify({"error": error}), 400

        connection = None
        cursor = None
        new_path = f"{profile_id}/{uuid.uuid4().hex}"
        uploaded = False

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT profile_picture_path
                FROM profiles
                WHERE id = %s
                """,
                (profile_id,),
            )
            row = cursor.fetchone()

            if row is None:
                return jsonify({"error": "Profile not found."}), 404

            old_path = row[0]
            supabase = get_storage_supabase()

            supabase.storage.from_(PICTURE_BUCKET).upload(
                new_path,
                image_bytes,
                file_options={
                    "content-type": content_type,
                    "upsert": "false",
                },
            )
            uploaded = True

            cursor.execute(
                """
                UPDATE profiles
                SET profile_picture_path = %s
                WHERE id = %s
                """,
                (new_path, profile_id),
            )
            connection.commit()

            if old_path:
                try:
                    supabase.storage.from_(PICTURE_BUCKET).remove([old_path])
                except Exception:
                    app.logger.warning(
                        "Could not remove the previous profile picture."
                    )

            return jsonify(
                {
                    "message": "Profile picture uploaded successfully.",
                    "profile_picture_path": new_path,
                }
            ), 200

        except Exception:
            if connection is not None:
                connection.rollback()

            if uploaded:
                try:
                    get_storage_supabase().storage.from_(PICTURE_BUCKET).remove(
                        [new_path]
                    )
                except Exception:
                    app.logger.warning(
                        "Could not clean up the uploaded profile picture."
                    )

            app.logger.exception("Profile picture upload failed")
            return jsonify(
                {"error": "Unable to upload the profile picture."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @app.get("/api/profiles/<profile_id>/picture")
    def get_profile_picture(profile_id):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT profile_picture_path
                FROM profiles
                WHERE id = %s
                """,
                (profile_id,),
            )
            row = cursor.fetchone()

            if row is None:
                return jsonify({"error": "Profile not found."}), 404

            picture_path = row[0]

            if not picture_path:
                return jsonify(
                    {"error": "No profile picture has been uploaded."}
                ), 404

            response = get_storage_supabase().storage.from_(
                PICTURE_BUCKET
            ).create_signed_url(picture_path, 300)

            if isinstance(response, dict):
                signed_url = (
                    response.get("signedURL")
                    or response.get("signedUrl")
                )
            else:
                signed_url = (
                    getattr(response, "signed_url", None)
                    or getattr(response, "signedURL", None)
                )

            if not signed_url:
                return jsonify(
                    {"error": "Unable to retrieve the profile picture."}
                ), 500

            return jsonify({"url": signed_url}), 200

        except Exception:
            app.logger.exception("Profile picture retrieval failed")
            return jsonify(
                {"error": "Unable to retrieve the profile picture."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @app.delete("/api/profiles/<profile_id>/picture")
    def delete_profile_picture(profile_id):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error

        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT profile_picture_path
                FROM profiles
                WHERE id = %s
                """,
                (profile_id,),
            )
            row = cursor.fetchone()

            if row is None:
                return jsonify({"error": "Profile not found."}), 404

            picture_path = row[0]

            if not picture_path:
                return jsonify(
                    {"error": "No profile picture to delete."}
                ), 404

            cursor.execute(
                """
                UPDATE profiles
                SET profile_picture_path = NULL
                WHERE id = %s
                """,
                (profile_id,),
            )
            connection.commit()

            try:
                get_storage_supabase().storage.from_(PICTURE_BUCKET).remove(
                    [picture_path]
                )
            except Exception:
                app.logger.warning(
                    "Could not remove the deleted picture from storage."
                )

            return jsonify(
                {"message": "Profile picture deleted successfully."}
            ), 200

        except Exception:
            if connection is not None:
                connection.rollback()

            app.logger.exception("Profile picture deletion failed")
            return jsonify(
                {"error": "Unable to delete the profile picture."}
            ), 500

        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()


    # Resume management

    RESUME_COLUMNS = [
        "id",
        "profile_id",
        "file_name",
        "storage_path",
        "content_type",
        "file_size",
        "uploaded_at",
    ]

    ALLOWED_RESUME_TYPES = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
    }

    def resume_to_dict(row):
        """Convert a database resume row into a JSON-friendly dictionary."""
        return dict(zip(RESUME_COLUMNS, row))

    def get_resume_storage():
        """Return the configured Supabase Storage bucket."""
        return get_storage_supabase().storage.from_(app.config["RESUME_BUCKET"])

    def check_resume_access(profile_id):
        """Allow only the authenticated owner to manage a resume."""
        if not is_valid_uuid(profile_id):
            return None, (jsonify({"error": "Invalid profile ID."}), 400)

        user = get_current_user()

        if user is None:
            return None, (
                jsonify({"error": "Authentication required."}),
                401,
            )

        if str(user.id) != profile_id:
            return None, (
                jsonify({"error": "Access denied."}),
                403,
            )

        return user, None

    def read_resume_upload():
        """Validate and read the uploaded resume file."""
        file = request.files.get("resume")

        if file is None or not file.filename:
            return None, (
                jsonify({"error": "A resume file is required."}),
                400,
            )

        file_name = secure_filename(file.filename)

        if not file_name:
            return None, (
                jsonify({"error": "Invalid filename."}),
                400,
            )

        extension = os.path.splitext(file_name)[1].lower()

        if extension not in ALLOWED_RESUME_TYPES:
            return None, (
                jsonify({"error": "Only PDF and DOC files are allowed."}),
                400,
            )

        
        file_bytes = file.stream.read(
            app.config["RESUME_MAX_SIZE"] + 1
        )

        if not file_bytes:
            return None, (
                jsonify({"error": "The uploaded file is empty."}),
                400,
            )

        if len(file_bytes) > app.config["RESUME_MAX_SIZE"]:
            return None, (
                jsonify({"error": "Resume must be 10 MB or smaller."}),
                413,
            )

        content_type = ALLOWED_RESUME_TYPES[extension]

        return {
            "file_name": file_name,
            "file_bytes": file_bytes,
            "content_type": content_type,
            "file_size": len(file_bytes),
            "extension": extension,
        }, None

    def upload_resume(profile_id, replace_existing=False):
        """Upload a new resume or replace the user's existing resume."""
        _, access_error = check_resume_access(profile_id)

        if access_error:
            return access_error

        upload, upload_error = read_resume_upload()

        if upload_error:
            return upload_error

        connection = None
        new_storage_path = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, profile_id, file_name, storage_path,
                       content_type, file_size, uploaded_at
                FROM resumes
                WHERE profile_id = %s
                """,
                (profile_id,),
            )
            existing_row = cursor.fetchone()

            if existing_row and not replace_existing:
                connection.rollback()
                return jsonify({
                    "error": "A resume already exists. Use PUT to replace it."
                }), 409

            if not existing_row and replace_existing:
                connection.rollback()
                return jsonify({"error": "Resume not found."}), 404

            
            new_storage_path = (
                f"{profile_id}/{uuid.uuid4().hex}"
                f"{upload['extension']}"
            )

            storage = get_resume_storage()

            storage.upload(
                new_storage_path,
                upload["file_bytes"],
                file_options={
                    "content-type": upload["content_type"],
                    "upsert": "false",
                },
            )

            if existing_row:
                old_resume = resume_to_dict(existing_row)

                cursor.execute(
                    """
                    UPDATE resumes
                    SET file_name = %s,
                        storage_path = %s,
                        content_type = %s,
                        file_size = %s,
                        uploaded_at = CURRENT_TIMESTAMP
                    WHERE profile_id = %s
                    RETURNING id, profile_id, file_name, storage_path,
                              content_type, file_size, uploaded_at
                    """,
                    (
                        upload["file_name"],
                        new_storage_path,
                        upload["content_type"],
                        upload["file_size"],
                        profile_id,
                    ),
                )
            else:
                old_resume = None

                cursor.execute(
                    """
                    INSERT INTO resumes (
                        profile_id, file_name, storage_path,
                        content_type, file_size, uploaded_at
                    )
                    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    RETURNING id, profile_id, file_name, storage_path,
                              content_type, file_size, uploaded_at
                    """,
                    (
                        profile_id,
                        upload["file_name"],
                        new_storage_path,
                        upload["content_type"],
                        upload["file_size"],
                    ),
                )

            saved_row = cursor.fetchone()
            connection.commit()

           
            if old_resume:
                try:
                    storage.remove([old_resume["storage_path"]])
                except Exception:
                    
                    pass

            return jsonify({
                "message": (
                    "Resume replaced successfully."
                    if old_resume
                    else "Resume uploaded successfully."
                ),
                "resume": resume_to_dict(saved_row),
            }), 200 if old_resume else 201

        except Exception:
            if connection is not None:
                connection.rollback()

            
            if new_storage_path:
                try:
                    get_resume_storage().remove([new_storage_path])
                except Exception:
                    pass

            return jsonify({"error": "Unable to save resume."}), 500

        finally:
            if connection is not None:
                connection.close()

    @app.route(
        "/api/profiles/<profile_id>/resume",
        methods=["POST"],
    )
    def create_resume(profile_id):
        return upload_resume(profile_id)

    @app.route(
        "/api/profiles/<profile_id>/resume",
        methods=["PUT"],
    )
    def replace_resume(profile_id):
        return upload_resume(profile_id, replace_existing=True)

    @app.route(
        "/api/profiles/<profile_id>/resume",
        methods=["GET"],
    )
    def get_resume(profile_id):
        _, access_error = check_resume_access(profile_id)

        if access_error:
            return access_error

        connection = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, profile_id, file_name, storage_path,
                       content_type, file_size, uploaded_at
                FROM resumes
                WHERE profile_id = %s
                """,
                (profile_id,),
            )
            row = cursor.fetchone()

            if row is None:
                return jsonify({"error": "Resume not found."}), 404

            resume = resume_to_dict(row)

            result = get_resume_storage().create_signed_url(
                resume["storage_path"],
                app.config["RESUME_SIGNED_URL_SECONDS"],
            )

            # Supabase SDK versions may use either key spelling.
            signed_url = (
                result.get("signedURL")
                or result.get("signedUrl")
            )

            if not signed_url:
                return jsonify({
                    "error": "Unable to generate resume download link."
                }), 500

            resume["download_url"] = signed_url

            return jsonify({"resume": resume}), 200

        except Exception:
            return jsonify({"error": "Unable to retrieve resume."}), 500

        finally:
            if connection is not None:
                connection.close()

    @app.route(
        "/api/profiles/<profile_id>/resume",
        methods=["DELETE"],
    )
    def delete_resume(profile_id):
        _, access_error = check_resume_access(profile_id)

        if access_error:
            return access_error

        connection = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT storage_path
                FROM resumes
                WHERE profile_id = %s
                """,
                (profile_id,),
            )
            row = cursor.fetchone()

            if row is None:
                return jsonify({"error": "Resume not found."}), 404

            storage_path = row[0]

            # Remove the file before deleting its database record.
            get_resume_storage().remove([storage_path])

            cursor.execute(
                "DELETE FROM resumes WHERE profile_id = %s",
                (profile_id,),
            )
            connection.commit()

            return jsonify({
                "message": "Resume deleted successfully."
            }), 200

        except Exception:
            if connection is not None:
                connection.rollback()

            return jsonify({"error": "Unable to delete resume."}), 500

        finally:
            if connection is not None:
                connection.close()


    # -------------------------
    # Job Search and Listings
    # -------------------------

    @app.get("/api/jobs")
    def get_jobs():
        connection = None
        cursor = None

        try:
            # Read optional search filters.
            keyword = request.args.get("keyword", "").strip()
            location = request.args.get("location", "").strip()
            category = request.args.get("category", "").strip()

            # Read optional salary filters.
            min_salary = request.args.get("min_salary")
            max_salary = request.args.get("max_salary")

            try:
                min_salary = (
                    float(min_salary) if min_salary else None
                )
                max_salary = (
                    float(max_salary) if max_salary else None
                )

                # Salary values must be finite and non-negative.
                import math

                if (
                    (min_salary is not None and
                     (not math.isfinite(min_salary) or min_salary < 0))
                    or
                    (max_salary is not None and
                     (not math.isfinite(max_salary) or max_salary < 0))
                ):
                    raise ValueError

            except ValueError:
                return jsonify({
                    "error": "Salary filters must be valid, non-negative numbers."
                }), 400

            if (
                min_salary is not None
                and max_salary is not None
                and min_salary > max_salary
            ):
                return jsonify({
                    "error": "Minimum salary cannot exceed maximum salary."
                }), 400

            # Retrieve published jobs.
            query = """
                SELECT id, title, company_name, location,
                       category, description, min_salary,
                       max_salary, created_at
                FROM public.jobs
                WHERE status = 'published'
            """
            params = []

            # Search across the main job fields.
            if keyword:
                query += """
                    AND (
                        title ILIKE %s
                        OR company_name ILIKE %s
                        OR description ILIKE %s
                        OR location ILIKE %s
                        OR category ILIKE %s
                    )
                """
                search_term = f"%{keyword}%"
                params.extend([search_term] * 5)

            # Optional location filter.
            if location:
                query += " AND location ILIKE %s"
                params.append(f"%{location}%")

            # Optional category filter.
            if category:
                query += " AND category ILIKE %s"
                params.append(f"%{category}%")

            # Include jobs whose salary ranges overlap the
            # requested range. NULL means the bound is unspecified.
            if min_salary is not None:
                query += """
                    AND (max_salary IS NULL OR max_salary >= %s)
                """
                params.append(min_salary)

            if max_salary is not None:
                query += """
                    AND (min_salary IS NULL OR min_salary <= %s)
                """
                params.append(max_salary)

            query += " ORDER BY created_at DESC"

            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(query, tuple(params))

            columns = [column[0] for column in cursor.description]
            jobs = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]

            # Convert salary values to JSON-friendly numbers.
            for job in jobs:
                if job["min_salary"] is not None:
                    job["min_salary"] = float(job["min_salary"])
                if job["max_salary"] is not None:
                    job["max_salary"] = float(job["max_salary"])

            return jsonify({"jobs": jobs}), 200

        except Exception:
            app.logger.exception("Job listing retrieval failed")
            return jsonify({
                "error": "Unable to retrieve jobs at this time."
            }), 500

        finally:
            if cursor is not None:
                cursor.close()

            if connection is not None:
                connection.close()

    @app.get("/api/jobs/<int:job_id>")
    def get_job_details(job_id):
        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                """
                SELECT id, title, company_name, location,
                       category, description, min_salary,
                       max_salary, created_at
                FROM public.jobs
                WHERE id = %s AND status = 'published'
                """,
                (job_id,)
            )

            row = cursor.fetchone()

            if row is None:
                return jsonify({
                    "error": "Job not found."
                }), 404

            columns = [column[0] for column in cursor.description]
            job = dict(zip(columns, row))

            # Convert salary values to JSON-friendly numbers.
            if job["min_salary"] is not None:
                job["min_salary"] = float(job["min_salary"])
            if job["max_salary"] is not None:
                job["max_salary"] = float(job["max_salary"])

            return jsonify({"job": job}), 200

        except Exception:
            app.logger.exception("Job details retrieval failed")
            return jsonify({
                "error": "Unable to retrieve job details at this time."
            }), 500

        finally:
            if cursor is not None:
                cursor.close()

            if connection is not None:
                connection.close()

  
    if __package__:
        from .application_submission import register_application_submission_routes
    else:
        from application_submission import register_application_submission_routes

    register_application_submission_routes(
        app, get_connection, get_current_user
    )


    if __package__:
        from .application_tracking import register_application_tracking_routes
    else:
        from application_tracking import register_application_tracking_routes

    register_application_tracking_routes(
        app, get_connection, get_current_user
    )


    if __package__:
        from .recruiter_postings import register_recruiter_posting_routes
    else:
        from recruiter_postings import register_recruiter_posting_routes

    register_recruiter_posting_routes(
        app, get_connection, get_current_user
    )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
