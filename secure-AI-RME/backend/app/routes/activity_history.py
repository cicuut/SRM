from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, Audit, User
from datetime import datetime, time
import json


activity_history_bp = Blueprint("activity_history", __name__)


ACTIVITY_ALLOWED_ROLES = ["admin", "midwife"]


FIELD_LABELS = {
    "module": "Modul",
    "record_code": "ID Record",
    "transaction_number": "Nomor Invoice",
    "patient_name": "Nama Pasien",
    "patient_number": "No. Pasien",
    "record_number": "No. Rekam Medis",
    "record_type": "Jenis Rekam Medis",
    "visit_number": "No. Kunjungan",
    "visit_display": "Visit / Record",
    "visit_date": "Tanggal Kunjungan",
    "visit_time": "Waktu Kunjungan",
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
    "user_name": "Dibuat Oleh",
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

DISPLAY_FIELD_ORDER = [
    "transaction_number",
    "payment_date",
    "trans_type",
    "amount",
    "payment_method",
    "status",
    "description",
    "visit_display",
    "visit_number",
    "record_number",
    "record_type",
    "patient_name",
    "patient_number",
    "user_name",
    "fullname",
    "email",
    "user_role",
    "role",
    "clinic_name",
    "clinic_address",
    "clinic_phone",
    "clinic_email",
    "license_number",
    "is_active",
    "subjective",
    "objective",
    "assessment",
    "plan",
    "diagnosis",
    "weight_kg",
    "height_cm",
    "blood_pressure",
    "body_temperature",
    "heart_rate",
    "respiratory_rate",
    "created_at",
    "last_update",
    "last_login",
]

IGNORED_DISPLAY_KEYS = {
    "module",
    "record_id",
    "record_code",
    "raw_record_id",
    "trans_id",
}

HIDDEN_DISPLAY_KEYS = {
    "id",
    "transaction_id",
    "patient_id",
    "clinic_id",
    "user_id",
    "visit_id",
    "record_id",
    "raw_record_id",
    "pr_id",
    "kb_id",
    "gr_id",
    "dr_id",
    "ir_id",
    "visit_anc_id",
    "visit_kb_id",
    "visit_gen_id",
    "visit_imun_id",
    "history_id",
    "patient_clinic_id",
    "user_clinic_id",
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


def normalize_role(role):
    normalized = str(role or "").strip().lower()

    role_aliases = {
        "admin": "admin",
        "developer": "admin",
        "midwife": "midwife",
        "bidan": "midwife",
        "owner": "midwife",
        "asisten": "asisten",
        "assistant": "asisten",
        "staff": "asisten",
    }

    return role_aliases.get(normalized, normalized)


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


def require_activity_history_access():
    current_user = get_current_user()

    if not current_user:
        return None, "", (jsonify({"msg": "User tidak ditemukan."}), 404)

    if not current_user.is_active:
        return None, "", (jsonify({"msg": "Akun Anda sedang tidak aktif."}), 403)

    current_role = normalize_role(current_user.user_role)

    if current_role not in ACTIVITY_ALLOWED_ROLES:
        return None, current_role, (
            jsonify(
                {
                    "msg": "Akses ditolak. Hanya admin dan bidan yang dapat mengakses riwayat aktivitas."
                }
            ),
            403,
        )

    if current_role == "midwife" and not current_user.clinic_id:
        return None, current_role, (
            jsonify(
                {
                    "msg": "Akun bidan belum terhubung dengan klinik.",
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                }
            ),
            400,
        )

    return current_user, current_role, None


def stringify_json(value):
    if value is None:
        return ""

    if isinstance(value, str):
        return value

    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return str(value)


def safe_parse_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    raw_value = str(value).strip()

    try:
        if raw_value.endswith("Z"):
            raw_value = raw_value.replace("Z", "+00:00")

        parsed = datetime.fromisoformat(raw_value)

        return parsed
    except Exception:
        pass

    for fmt in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y",
    ]:
        try:
            return datetime.strptime(raw_value.split(".")[0], fmt)
        except Exception:
            continue

    return None


def format_date_value(value):
    parsed = safe_parse_datetime(value)

    if not parsed:
        return str(value)

    has_time = "T" in str(value) or " " in str(value)

    if has_time:
        return parsed.strftime("%d %B %Y, %H:%M")

    return parsed.strftime("%d %B %Y")


def format_rupiah(value):
    try:
        amount = float(value)
    except Exception:
        return str(value)

    formatted = f"{amount:,.0f}".replace(",", ".")

    return f"Rp {formatted}"


def format_enum_label(value):
    if value is None:
        return "-"

    text_value = str(value).strip()

    if not text_value:
        return "-"

    lower_value = text_value.lower()

    enum_map = {
        "paid": "Dibayar",
        "unpaid": "Belum Dibayar",
        "pemasukan": "Pemasukan",
        "pengeluaran": "Pengeluaran",
        "cash": "Tunai",
        "transfer": "Transfer",
        "qris": "QRIS",
        "admin": "Admin",
        "midwife": "Bidan",
        "bidan": "Bidan",
        "asisten": "Asisten",
        "assistant": "Asisten",
        "active": "Aktif",
        "inactive": "Tidak Aktif",
        "true": "Ya",
        "false": "Tidak",
    }

    if lower_value in enum_map:
        return enum_map[lower_value]

    return text_value.replace("_", " ").replace("-", " ").title()


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


def get_raw_record_id_from_values(old_values, new_values):
    candidate_keys = [
        "record_id",
        "transaction_id",
        "visit_id",
        "patient_id",
        "user_id",
        "clinic_id",
        "pr_id",
        "kb_id",
        "gr_id",
        "dr_id",
        "ir_id",
        "visit_anc_id",
        "visit_kb_id",
        "visit_gen_id",
        "visit_imun_id",
        "history_id",
        "id",
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

    return str(key).replace("_", " ").replace("-", " ").title()


def should_hide_display_key(key):
    key_text = str(key or "").strip()
    lower_key = key_text.lower()

    if key_text in IGNORED_DISPLAY_KEYS:
        return True

    if lower_key in HIDDEN_DISPLAY_KEYS:
        return True

    if lower_key.endswith("_id"):
        return True

    return False


def format_display_value_by_key(key, value):
    if value is None:
        return "-"

    if value == "":
        return "-"

    if isinstance(value, bool):
        return "Ya" if value else "Tidak"

    if isinstance(value, (dict, list)):
        return stringify_json(value)

    key_text = str(key or "").lower()
    text_value = str(value)

    if text_value == "[hidden]":
        return "[disembunyikan]"

    if text_value == "[set]":
        return "[terisi]"

    if key_text in {"amount", "nominal"}:
        return format_rupiah(value)

    if key_text in {
        "payment_date",
        "visit_date",
        "created_at",
        "last_update",
        "last_login",
        "date_time",
        "times",
    }:
        return format_date_value(value)

    if key_text in {
        "status",
        "trans_type",
        "payment_method",
        "user_role",
        "role",
        "record_type",
    }:
        return format_enum_label(text_value)

    return text_value


def get_display_keys(old_values, new_values):
    keys = set()

    if isinstance(old_values, dict):
        keys.update(old_values.keys())

    if isinstance(new_values, dict):
        keys.update(new_values.keys())

    visible_keys = [
        key
        for key in keys
        if not should_hide_display_key(key)
    ]

    ordered_keys = [
        key
        for key in DISPLAY_FIELD_ORDER
        if key in visible_keys
    ]

    remaining_keys = sorted(
        [
            key
            for key in visible_keys
            if key not in DISPLAY_FIELD_ORDER
        ]
    )

    return ordered_keys + remaining_keys


def changed_field_list(old_values, new_values):
    if not isinstance(old_values, dict):
        old_values = {}

    if not isinstance(new_values, dict):
        new_values = {}

    fields = []

    for key in get_display_keys(old_values, new_values):
        old_value = format_display_value_by_key(key, old_values.get(key))
        new_value = format_display_value_by_key(key, new_values.get(key))

        if old_value == new_value:
            continue

        fields.append(
            {
                "key": key,
                "label": get_display_label(key),
                "old_value": old_value,
                "new_value": new_value,
            }
        )

    return fields


def format_created_new_value(new_values):
    if not isinstance(new_values, dict) or not new_values:
        return "Data baru dibuat."

    lines = ["Data baru dibuat:"]

    for key in get_display_keys({}, new_values):
        value = format_display_value_by_key(key, new_values.get(key))
        lines.append(f"• {get_display_label(key)}: {value}")

    return "\n".join(lines)


def format_deleted_old_value(old_values):
    if not isinstance(old_values, dict) or not old_values:
        return "Data dihapus."

    lines = ["Data yang dihapus:"]

    for key in get_display_keys(old_values, {}):
        value = format_display_value_by_key(key, old_values.get(key))
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

        value = format_display_value_by_key(key, old_values.get(key))
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

        value = format_display_value_by_key(key, new_values.get(key))
        lines.append(f"• {get_display_label(key)}: {value}")

    return "\n".join(lines)


def get_action_mode(action):
    normalized_action = str(action or "").lower()

    if normalized_action.startswith("create") or normalized_action.startswith("add"):
        return "create"

    if normalized_action.startswith("delete") or normalized_action.startswith("remove"):
        return "delete"

    if normalized_action.startswith("update") or normalized_action.startswith("edit"):
        return "update"

    return "other"


def friendly_old_new_value(action, old_values, new_values):
    action_mode = get_action_mode(action)

    if action_mode == "create":
        return "Tidak ada data sebelumnya.", format_created_new_value(new_values)

    if action_mode == "delete":
        return format_deleted_old_value(old_values), "Data sudah dihapus dari sistem."

    if action_mode == "update":
        return (
            format_updated_old_value(old_values, new_values),
            format_updated_new_value(old_values, new_values),
        )

    return stringify_json(old_values), stringify_json(new_values)


def make_table_summary(action, old_values, new_values):
    action_mode = get_action_mode(action)

    if not isinstance(old_values, dict):
        old_values = {}

    if not isinstance(new_values, dict):
        new_values = {}

    if action_mode == "create":
        record_code = (
            new_values.get("record_code")
            or new_values.get("transaction_number")
            or new_values.get("visit_number")
            or new_values.get("record_number")
            or new_values.get("patient_number")
        )

        if record_code:
            return "-", f"Data baru dibuat: {record_code}"

        return "-", "Data baru dibuat"

    if action_mode == "delete":
        record_code = (
            old_values.get("record_code")
            or old_values.get("transaction_number")
            or old_values.get("visit_number")
            or old_values.get("record_number")
            or old_values.get("patient_number")
        )

        if record_code:
            return f"Data dihapus: {record_code}", "-"

        return "Data dihapus", "-"

    changed_fields = changed_field_list(old_values, new_values)

    if not changed_fields:
        return "-", "Tidak ada perubahan field"

    old_parts = []
    new_parts = []

    for item in changed_fields[:3]:
        old_parts.append(f"{item['label']}: {item['old_value']}")
        new_parts.append(f"{item['label']}: {item['new_value']}")

    if len(changed_fields) > 3:
        old_parts.append(f"+{len(changed_fields) - 3} field lainnya")
        new_parts.append(f"+{len(changed_fields) - 3} field lainnya")

    return "; ".join(old_parts), "; ".join(new_parts)


def value_list_from_dict(values, compare_values=None):
    if not isinstance(values, dict):
        return []

    compare_values = compare_values if isinstance(compare_values, dict) else {}

    result = []

    for key in get_display_keys(values, compare_values):
        result.append(
            {
                "key": key,
                "label": get_display_label(key),
                "value": format_display_value_by_key(key, values.get(key)),
            }
        )

    return result


def serialize_audit_row(audit, user):
    old_values = audit.old_values or {}
    new_values = audit.new_values or {}

    user_name = "-"
    user_email = "-"

    if user:
        user_name = user.fullname or "-"
        user_email = user.email or "-"

    old_value_text, new_value_text = make_table_summary(
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


def serialize_audit_detail(audit, user):
    old_values = audit.old_values or {}
    new_values = audit.new_values or {}

    user_name = "-"
    user_email = "-"
    user_role = "-"

    if user:
        user_name = user.fullname or "-"
        user_email = user.email or "-"
        user_role = user.user_role or "-"

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
        "user_role": user_role,
        "action": audit.action or "-",
        "module": get_module_from_values(old_values, new_values),
        "record_id": get_record_id_from_values(old_values, new_values),
        "raw_record_id": get_raw_record_id_from_values(old_values, new_values),
        "old_value": old_value_text,
        "new_value": new_value_text,
        "old_items": value_list_from_dict(old_values, new_values),
        "new_items": value_list_from_dict(new_values, old_values),
        "changed_fields": changed_field_list(old_values, new_values),
    }


def apply_search_filter(serialized_rows, search_query):
    if not search_query:
        return serialized_rows

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

    return filtered_rows


def build_activity_query(current_user, current_role):
    query = (
        db.session.query(Audit, User)
        .outerjoin(User, Audit.user_id == User.user_id)
    )

    query = query.filter(User.clinic_id == current_user.clinic_id)

    return query


@activity_history_bp.route("/get-all", methods=["GET"])
@jwt_required()
def get_all_activity_history():
    current_user, current_role, error_response = require_activity_history_access()

    if error_response:
        return error_response

    try:
        date_filter = (request.args.get("date") or "").strip()
        search_query = (request.args.get("search") or "").strip().lower()
        action_filter = (request.args.get("action") or "").strip()

        query = build_activity_query(current_user, current_role)

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

        rows = (
            query
            .order_by(
                Audit.times.desc(),
                Audit.audit_number.desc(),
                Audit.log_id.desc(),
            )
            .all()
        )

        serialized_rows = [
            serialize_audit_row(audit, user)
            for audit, user in rows
        ]

        serialized_rows = apply_search_filter(serialized_rows, search_query)

        return jsonify(serialized_rows), 200

    except ValueError:
        return jsonify({"msg": "Format tanggal tidak valid. Gunakan YYYY-MM-DD."}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal mengambil riwayat aktivitas.",
                    "error": str(e),
                }
            ),
            500,
        )


@activity_history_bp.route("/detail/<audit_id>", methods=["GET"])
@jwt_required()
def get_activity_history_detail(audit_id):
    current_user, current_role, error_response = require_activity_history_access()

    if error_response:
        return error_response

    try:
        query = build_activity_query(current_user, current_role)
        row = query.filter(Audit.log_id == str(audit_id)).first()

        if not row:
            return jsonify({"msg": "Log aktivitas tidak ditemukan."}), 404

        audit, user = row

        return jsonify({"data": serialize_audit_detail(audit, user)}), 200

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal mengambil detail riwayat aktivitas.",
                    "error": str(e),
                }
            ),
            500,
        )


@activity_history_bp.route("/actions", methods=["GET"])
@jwt_required()
def get_activity_actions():
    current_user, current_role, error_response = require_activity_history_access()

    if error_response:
        return error_response

    try:
        query = db.session.query(Audit.action)

        if current_role == "midwife":
            query = (
                query
                .join(User, Audit.user_id == User.user_id)
                .filter(User.clinic_id == current_user.clinic_id)
            )
        else:
            query = query.outerjoin(User, Audit.user_id == User.user_id)

        rows = (
            query
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
                    "msg": "Gagal mengambil daftar aksi aktivitas.",
                    "error": str(e),
                }
            ),
            500,
        )