from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, Audit, User
from datetime import datetime, time
import json


activity_history_bp = Blueprint("activity_history", __name__)


FIELD_LABELS = {
    "module": "Module",
    "record_id": "Record ID",
    "record_code": "Record Code",
    "transaction_id": "Transaction ID",
    "transaction_number": "Nomor Invoice",
    "patient_id": "Patient ID",
    "patient_name": "Nama Pasien",
    "patient_number": "No. Pasien",
    "record_number": "No. Rekam Medis",
    "record_type": "Jenis Rekam Medis",
    "visit_id": "Visit ID",
    "visit_number": "No. Kunjungan",
    "visit_date": "Tanggal Kunjungan",
    "visit_time": "Waktu Kunjungan",
    "user_id": "User ID",
    "clinic_id": "Clinic ID",
    "fullname": "Nama Lengkap",
    "email": "Email",
    "user_role": "Role",
    "role": "Role",
    "strnumber": "Nomor STR",
    "is_active": "Status Aktif",
    "clinic_name": "Nama Klinik",
    "clinic_address": "Alamat Klinik",
    "license_number": "No. SIPB",
    "clinic_email": "Email Klinik",
    "clinic_phone": "Telepon Klinik",
    "status": "Status",
    "trans_type": "Tipe Transaksi",
    "amount": "Nominal",
    "payment_method": "Metode Pembayaran",
    "payment_date": "Tanggal Pembayaran",
    "description": "Deskripsi",
    "created_at": "Dibuat Pada",
    "last_update": "Update Terakhir",
    "last_login": "Login Terakhir",
    "subjective": "Subjective",
    "objective": "Objective",
    "assessment": "Assessment",
    "plan": "Plan",
    "diagnosis": "Diagnosis",
    "weight_kg": "Berat Badan",
    "height_cm": "Tinggi Badan",
    "blood_pressure": "Tekanan Darah",
    "body_temperature": "Suhu Tubuh",
    "heart_rate": "Denyut Jantung",
    "respiratory_rate": "Respiratory Rate",
}

IGNORED_DISPLAY_KEYS = {
    "module",
    "record_id",
    "record_code",
}

HIDDEN_DISPLAY_KEYS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "profile_photo",
}


def to_str(value):
    if value is None:
        return ""

    return str(value)


def format_datetime(value):
    if not value:
        return ""

    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d %H:%M:%S")

    return str(value)


def parse_date(value):
    if not value:
        return None

    raw_value = str(value).strip()

    if "T" in raw_value:
        raw_value = raw_value.split("T")[0]

    return datetime.strptime(raw_value, "%Y-%m-%d").date()


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_admin():
    current_user = get_current_user()

    if not current_user:
        return None, (jsonify({"msg": "User not found"}), 404)

    if not current_user.is_active:
        return None, (jsonify({"msg": "Your account is inactive"}), 403)

    if current_user.user_role != "admin":
        return None, (jsonify({"msg": "Only admin can access activity history"}), 403)

    if not current_user.clinic_id:
        return None, (jsonify({"msg": "Your account is not linked to a clinic"}), 400)

    return current_user, None


def stringify_json(value):
    if value is None:
        return ""

    if isinstance(value, str):
        return value

    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value)


def get_module_from_values(old_values, new_values):
    if isinstance(new_values, dict) and new_values.get("module"):
        return to_str(new_values.get("module"))

    if isinstance(old_values, dict) and old_values.get("module"):
        return to_str(old_values.get("module"))

    return "-"


def get_record_id_from_values(old_values, new_values):
    candidate_keys = [
        "record_code",
        "transaction_number",
        "visit_number",
        "record_number",
        "patient_number",
        "audit_number",
    ]

    if isinstance(new_values, dict):
        for key in candidate_keys:
            if new_values.get(key):
                return to_str(new_values.get(key))

    if isinstance(old_values, dict):
        for key in candidate_keys:
            if old_values.get(key):
                return to_str(old_values.get(key))

    return "-"


def get_display_label(key):
    if key in FIELD_LABELS:
        return FIELD_LABELS[key]

    return (
        str(key)
        .replace("_", " ")
        .replace("-", " ")
        .title()
    )


def format_display_value(value):
    if value is None:
        return "-"

    if value == "":
        return "-"

    if isinstance(value, bool):
        return "Ya" if value else "Tidak"

    if isinstance(value, (dict, list)):
        return stringify_json(value)

    text_value = str(value)

    if text_value == "[hidden]":
        return "[disembunyikan]"

    if text_value == "[set]":
        return "[terisi]"

    return text_value


def get_display_keys(old_values, new_values):
    keys = set()

    if isinstance(old_values, dict):
        keys.update(old_values.keys())

    if isinstance(new_values, dict):
        keys.update(new_values.keys())

    keys = [
        key
        for key in keys
        if key not in IGNORED_DISPLAY_KEYS
        and str(key).lower() not in HIDDEN_DISPLAY_KEYS
    ]

    return sorted(keys)


def format_created_new_value(new_values):
    if not isinstance(new_values, dict) or not new_values:
        return "Data baru dibuat."

    lines = ["Data baru dibuat:"]

    for key in get_display_keys({}, new_values):
        value = format_display_value(new_values.get(key))

        lines.append(f"• {get_display_label(key)}: {value}")

    return "\n".join(lines)


def format_deleted_old_value(old_values):
    if not isinstance(old_values, dict) or not old_values:
        return "Data dihapus."

    lines = ["Data yang dihapus:"]

    for key in get_display_keys(old_values, {}):
        value = format_display_value(old_values.get(key))

        lines.append(f"• {get_display_label(key)}: {value}")

    return "\n".join(lines)


def format_updated_old_value(old_values, new_values):
    if not isinstance(old_values, dict):
        return "Tidak ada data sebelumnya."

    keys = get_display_keys(old_values, new_values)

    if not keys:
        return "Tidak ada perubahan lama yang tercatat."

    lines = ["Sebelum perubahan:"]

    for key in keys:
        if key not in old_values:
            continue

        value = format_display_value(old_values.get(key))

        lines.append(f"• {get_display_label(key)}: {value}")

    return "\n".join(lines)


def format_updated_new_value(old_values, new_values):
    if not isinstance(new_values, dict):
        return "Data diperbarui."

    keys = get_display_keys(old_values, new_values)

    if not keys:
        return "Tidak ada perubahan baru yang tercatat."

    lines = ["Sesudah perubahan:"]

    for key in keys:
        if key not in new_values:
            continue

        value = format_display_value(new_values.get(key))

        lines.append(f"• {get_display_label(key)}: {value}")

    return "\n".join(lines)


def friendly_old_new_value(action, old_values, new_values):
    normalized_action = str(action or "").lower()

    if normalized_action.startswith("create"):
        return "Tidak ada data sebelumnya.", format_created_new_value(new_values)

    if normalized_action.startswith("delete"):
        return format_deleted_old_value(old_values), "Data sudah dihapus dari sistem."

    if normalized_action.startswith("update"):
        return (
            format_updated_old_value(old_values, new_values),
            format_updated_new_value(old_values, new_values),
        )

    return stringify_json(old_values), stringify_json(new_values)


def serialize_audit_row(audit, user):
    old_values = audit.old_values or {}
    new_values = audit.new_values or {}

    user_name = "-"
    user_email = "-"

    if user:
        user_name = user.fullname or "-"
        user_email = user.email or "-"

    old_value_text, new_value_text = friendly_old_new_value(
        audit.action,
        old_values,
        new_values,
    )

    return {
        "audit_id": to_str(audit.log_id),
        "audit_number": audit.audit_number or "-",
        "date_time": format_datetime(audit.times),
        "user": user_name,
        "user_email": user_email,
        "action": audit.action or "-",
        "module": get_module_from_values(old_values, new_values),
        "record_id": get_record_id_from_values(old_values, new_values),
        "old_value": old_value_text,
        "new_value": new_value_text,
    }


@activity_history_bp.route("/get-all", methods=["GET"])
@jwt_required()
def get_all_activity_history():
    current_user, error_response = require_admin()

    if error_response:
        return error_response

    try:
        date_filter = request.args.get("date")
        search_query = (request.args.get("search") or "").strip().lower()
        action_filter = (request.args.get("action") or "").strip()

        query = (
            db.session.query(Audit, User)
            .outerjoin(User, Audit.user_id == User.user_id)
            .filter(User.clinic_id == current_user.clinic_id)
        )

        if date_filter:
            selected_date = parse_date(date_filter)
            start_datetime = datetime.combine(selected_date, time.min)
            end_datetime = datetime.combine(selected_date, time.max)

            query = query.filter(
                Audit.times >= start_datetime,
                Audit.times <= end_datetime,
            )

        if action_filter and action_filter != "all":
            query = query.filter(Audit.action == action_filter)

        rows = query.order_by(Audit.times.desc()).all()

        serialized_rows = [
            serialize_audit_row(audit, user)
            for audit, user in rows
        ]

        if search_query:
            filtered_rows = []

            for row in serialized_rows:
                searchable_text = " ".join(
                    [
                        row.get("audit_number", ""),
                        row.get("date_time", ""),
                        row.get("user", ""),
                        row.get("user_email", ""),
                        row.get("action", ""),
                        row.get("module", ""),
                        row.get("record_id", ""),
                        row.get("old_value", ""),
                        row.get("new_value", ""),
                    ]
                ).lower()

                if search_query in searchable_text:
                    filtered_rows.append(row)

            serialized_rows = filtered_rows

        return jsonify(serialized_rows), 200

    except ValueError:
        return jsonify({"msg": "Invalid date format. Use YYYY-MM-DD"}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Failed to get activity history",
                    "error": str(e),
                }
            ),
            500,
        )


@activity_history_bp.route("/actions", methods=["GET"])
@jwt_required()
def get_activity_actions():
    current_user, error_response = require_admin()

    if error_response:
        return error_response

    try:
        rows = (
            db.session.query(Audit.action)
            .join(User, Audit.user_id == User.user_id)
            .filter(User.clinic_id == current_user.clinic_id)
            .filter(Audit.action.isnot(None))
            .distinct()
            .order_by(Audit.action.asc())
            .all()
        )

        actions = [row[0] for row in rows if row[0]]

        return jsonify(actions), 200

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Failed to get activity actions",
                    "error": str(e),
                }
            ),
            500,
        )