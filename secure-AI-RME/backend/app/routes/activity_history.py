from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User
from sqlalchemy import text
from datetime import datetime, date
import json


activity_history_bp = Blueprint("activity_history", __name__)


def to_str(value):
    if value is None:
        return None

    return str(value)


def role_to_text(value):
    if value is None:
        return ""

    if hasattr(value, "value"):
        return str(value.value)

    return str(value)


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_admin_access():
    current_user = get_current_user()

    if not current_user:
        return None, (jsonify({"msg": "User not found"}), 404)

    if not current_user.is_active:
        return None, (jsonify({"msg": "Your account is inactive"}), 403)

    current_role = role_to_text(current_user.user_role)

    if current_role != "admin":
        return None, (
            jsonify({"msg": "Access denied. Only admin can access activity history."}),
            403,
        )

    if not current_user.clinic_id:
        return None, (
            jsonify({"msg": "Your account is not linked to a clinic"}),
            400,
        )

    return current_user, None


def parse_date(value):
    if not value:
        return None

    raw_value = str(value).strip()

    if not raw_value:
        return None

    return datetime.strptime(raw_value, "%Y-%m-%d").date()


def format_datetime(value):
    if not value:
        return None

    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    return str(value)


def json_to_dict(value):
    if value is None:
        return {}

    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    return {}


def compact_json(value):
    if value is None:
        return "-"

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception:
            return value or "-"

    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value)


def pick_first(data, keys, default="-"):
    if not isinstance(data, dict):
        return default

    for key in keys:
        value = data.get(key)

        if value is not None and value != "":
            return str(value)

    return default


def detect_module(action, old_values, new_values):
    module_from_json = pick_first(
        new_values,
        ["module", "table", "table_name", "feature", "page"],
        "",
    )

    if module_from_json:
        return module_from_json

    module_from_old = pick_first(
        old_values,
        ["module", "table", "table_name", "feature", "page"],
        "",
    )

    if module_from_old:
        return module_from_old

    action_text = str(action or "").lower()

    if "financial" in action_text or "invoice" in action_text:
        return "Financial"

    if "user" in action_text or "account" in action_text:
        return "User Access"

    if "clinic" in action_text:
        return "Clinic"

    if "login" in action_text or "logout" in action_text:
        return "Authentication"

    if "medical" in action_text or "record" in action_text:
        return "Medical Record"

    if "visit" in action_text:
        return "Daily Report"

    return "System"


def detect_record_id(old_values, new_values):
    keys = [
        "record_id",
        "transaction_id",
        "visit_id",
        "patient_id",
        "clinic_id",
        "user_id",
        "id",
    ]

    value_from_new = pick_first(new_values, keys, "")

    if value_from_new:
        return value_from_new

    value_from_old = pick_first(old_values, keys, "")

    if value_from_old:
        return value_from_old

    return "-"


def serialize_audit_row(row):
    old_values = json_to_dict(row.get("old_values"))
    new_values = json_to_dict(row.get("new_values"))

    action = row.get("action") or "-"

    return {
        "audit_id": to_str(row.get("log_id")),
        "audit_number": row.get("audit_number") or f"AUD-{row.get('log_id')}",
        "date_time": format_datetime(row.get("times")),
        "user": row.get("fullname") or row.get("email") or "-",
        "user_email": row.get("email") or "-",
        "action": action,
        "module": detect_module(action, old_values, new_values),
        "record_id": detect_record_id(old_values, new_values),
        "old_value": compact_json(row.get("old_values")),
        "new_value": compact_json(row.get("new_values")),
    }


@activity_history_bp.route("/get-all", methods=["GET"])
@jwt_required()
def get_all_activity_history():
    current_user, error_response = require_admin_access()

    if error_response:
        return error_response

    try:
        selected_date = request.args.get("date")
        search_query = (request.args.get("search") or "").strip().lower()
        action_filter = (request.args.get("action") or "").strip().lower()

        conditions = ["u.clinic_id::text = :clinic_id"]
        params = {
            "clinic_id": str(current_user.clinic_id),
        }

        if selected_date:
            conditions.append("CAST(a.times AS date) = :selected_date")
            params["selected_date"] = parse_date(selected_date)

        if action_filter and action_filter != "all":
            conditions.append("LOWER(a.action) = :action_filter")
            params["action_filter"] = action_filter

        if search_query:
            conditions.append(
                """
                (
                    LOWER(COALESCE(a.audit_number, '')) LIKE :search
                    OR LOWER(COALESCE(a.action, '')) LIKE :search
                    OR LOWER(COALESCE(u.fullname, '')) LIKE :search
                    OR LOWER(COALESCE(u.email, '')) LIKE :search
                    OR LOWER(COALESCE(CAST(a.old_values AS text), '')) LIKE :search
                    OR LOWER(COALESCE(CAST(a.new_values AS text), '')) LIKE :search
                    OR LOWER(COALESCE(CAST(a.log_id AS text), '')) LIKE :search
                )
                """
            )
            params["search"] = f"%{search_query}%"

        where_clause = "WHERE " + " AND ".join(conditions)

        rows = db.session.execute(
            text(
                f"""
                SELECT
                    a.log_id,
                    a.user_id::text AS user_id,
                    a.audit_number,
                    a.times,
                    a.action,
                    a.old_values,
                    a.new_values,
                    u.fullname,
                    u.email,
                    u.clinic_id::text AS clinic_id
                FROM audit a
                JOIN users u
                    ON u.user_id::text = a.user_id::text
                {where_clause}
                ORDER BY a.times DESC, a.log_id DESC
                """
            ),
            params,
        ).mappings().all()

        return jsonify([serialize_audit_row(row) for row in rows]), 200

    except ValueError:
        return jsonify({"msg": "Invalid date format. Use YYYY-MM-DD"}), 400

    except Exception as e:
        return jsonify({"msg": "Failed to get activity history", "error": str(e)}), 500


@activity_history_bp.route("/actions", methods=["GET"])
@jwt_required()
def get_activity_actions():
    current_user, error_response = require_admin_access()

    if error_response:
        return error_response

    try:
        rows = db.session.execute(
            text(
                """
                SELECT DISTINCT a.action
                FROM audit a
                JOIN users u
                    ON u.user_id::text = a.user_id::text
                WHERE u.clinic_id::text = :clinic_id
                ORDER BY a.action ASC
                """
            ),
            {"clinic_id": str(current_user.clinic_id)},
        ).all()

        actions = [row[0] for row in rows if row[0]]

        return jsonify(actions), 200

    except Exception as e:
        return jsonify({"msg": "Failed to get activity actions", "error": str(e)}), 500