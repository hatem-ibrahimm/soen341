from flask import jsonify, request


SECTION_CONFIG = {
    "experiences": {
        "table": "work_experiences",
        "columns": ("job_title", "company", "dates", "description"),
        "required": ("job_title", "company"),
        "limits": {
            "job_title": 160,
            "company": 160,
            "dates": 120,
            "description": 5000,
        },
        "select": (
            "id, job_title, company, dates, description "
            "FROM public.work_experiences"
        ),
    },
    "education": {
        "table": "education",
        "columns": ("school", "degree", "years"),
        "required": ("school",),
        "limits": {"school": 200, "degree": 160, "years": 120},
        "select": "id, school, degree, years FROM public.education",
    },
    "skills": {
        "table": "skills",
        "columns": ("name",),
        "required": ("name",),
        "limits": {"name": 80},
        "select": "name FROM public.skills",
    },
}


def _normalize_items(section, value):
    config = SECTION_CONFIG[section]
    if not isinstance(value, list) or len(value) > 100:
        return None, "items must be a list of at most 100 entries."

    normalized = []
    seen = set()
    for item in value:
        if section == "skills":
            item = {"name": item} if isinstance(item, str) else item
        if not isinstance(item, dict):
            return None, "Each item must be an object."

        row = {}
        for field in config["columns"]:
            raw = item.get(field, "")
            if raw is None:
                raw = ""
            if not isinstance(raw, str):
                return None, f"{field} must be text."
            text = raw.strip()
            if field in config["required"] and not text:
                return None, f"{field} is required."
            if len(text) > config["limits"][field]:
                return None, f"{field} must be {config['limits'][field]} characters or fewer."
            row[field] = text or None

        if section == "skills":
            key = row["name"].casefold()
            if key in seen:
                return None, "Skills must not contain duplicates."
            seen.add(key)
            normalized.append(row)
        else:
            normalized.append(row)

    return normalized, None


def register_profile_section_routes(app, get_connection, check_profile_access):
    @app.get("/api/profiles/<profile_id>/sections")
    def get_profile_sections(profile_id):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error

        connection = cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            result = {}
            for name, config in SECTION_CONFIG.items():
                cursor.execute(
                    f"SELECT {config['select']} "
                    "WHERE profile_id = %s ORDER BY display_order, created_at"
                    if name != "skills"
                    else f"SELECT {config['select']} "
                    "WHERE profile_id = %s ORDER BY created_at",
                    (profile_id,),
                )
                rows = cursor.fetchall()
                if name == "skills":
                    result[name] = [row[0] for row in rows]
                else:
                    result[name] = [
                        dict(zip(("id",) + config["columns"], row))
                        for row in rows
                    ]
                    for item in result[name]:
                        item["id"] = str(item["id"])
            return jsonify(result), 200
        except Exception:
            app.logger.exception("Profile section retrieval failed")
            return jsonify({"error": "Unable to retrieve profile sections."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

    @app.put("/api/profiles/<profile_id>/sections/<section>")
    def replace_profile_section(profile_id, section):
        access_error = check_profile_access(profile_id)
        if access_error:
            return access_error
        if section not in SECTION_CONFIG:
            return jsonify({"error": "Unknown profile section."}), 404

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or "items" not in payload:
            return jsonify({"error": "Request body must contain an items list."}), 400
        items, error = _normalize_items(section, payload["items"])
        if error:
            return jsonify({"error": error}), 400

        config = SECTION_CONFIG[section]
        connection = cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute(
                f"DELETE FROM public.{config['table']} WHERE profile_id = %s",
                (profile_id,),
            )
            for index, item in enumerate(items):
                columns = config["columns"]
                values = tuple(item[field] for field in columns)
                if section == "skills":
                    cursor.execute(
                        "INSERT INTO public.skills (profile_id, name) "
                        "VALUES (%s, %s)",
                        (profile_id, *values),
                    )
                else:
                    cursor.execute(
                        f"INSERT INTO public.{config['table']} "
                        f"(profile_id, {', '.join(columns)}, display_order) "
                        f"VALUES ({', '.join(['%s'] * (len(columns) + 2))})",
                        (profile_id, *values, index),
                    )
            if section == "skills":
                cursor.execute(
                    "SELECT name FROM public.skills "
                    "WHERE profile_id = %s ORDER BY created_at",
                    (profile_id,),
                )
                saved_items = [row[0] for row in cursor.fetchall()]
            else:
                cursor.execute(
                    f"SELECT id, {', '.join(config['columns'])} "
                    f"FROM public.{config['table']} WHERE profile_id = %s "
                    "ORDER BY display_order, created_at",
                    (profile_id,),
                )
                saved_items = [
                    dict(zip(("id",) + config["columns"], row))
                    for row in cursor.fetchall()
                ]
                for item in saved_items:
                    item["id"] = str(item["id"])
            connection.commit()
        except Exception:
            if connection is not None:
                connection.rollback()
            app.logger.exception("Profile section update failed")
            return jsonify({"error": "Unable to save profile section."}), 500
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()

        return jsonify({section: saved_items}), 200
