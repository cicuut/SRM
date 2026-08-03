from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User
from app.utils import (
    decrypt_data,
    generate_financial_number,
    write_audit_log,
    reserve_next_sequence,
    get_next_sequence_preview,
)
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import uuid


financial_bp = Blueprint("financial", __name__)

ADMIN_ROLE = "admin"
MIDWIFE_ROLE = "midwife"
ASSISTANT_ROLE = "asisten"

FINANCIAL_ALLOWED_ROLES = [ADMIN_ROLE, MIDWIFE_ROLE]


# -----------------------------------------------------------------------------
# Basic helpers
# -----------------------------------------------------------------------------
def to_str(value):
    if value is None:
        return None

    return str(value)


def role_to_text(value):
    if value is None:
        return ""

    if hasattr(value, "value"):
        value = value.value

    normalized = str(value or "").strip().lower()

    role_aliases = {
        "admin": ADMIN_ROLE,
        "developer": ADMIN_ROLE,
        "midwife": MIDWIFE_ROLE,
        "bidan": MIDWIFE_ROLE,
        "owner": MIDWIFE_ROLE,
        "asisten": ASSISTANT_ROLE,
        "assistant": ASSISTANT_ROLE,
        "staff": ASSISTANT_ROLE,
    }

    return role_aliases.get(normalized, normalized)


def is_admin_user(user):
    return role_to_text(getattr(user, "user_role", "")) == ADMIN_ROLE


def is_midwife_user(user):
    return role_to_text(getattr(user, "user_role", "")) == MIDWIFE_ROLE


def safe_decrypt(value):
    if value is None:
        return ""

    try:
        decrypted = decrypt_data(value)
        return decrypted if decrypted is not None else ""
    except Exception:
        return str(value)


def normalize_optional_uuid(value):
    if value is None:
        return None

    normalized = str(value).strip()

    if not normalized:
        return None

    if normalized.lower() in ["null", "none", "undefined", "-"]:
        return None

    return normalized


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def get_financial_scope_clinic_id(user):
    if not user or not hasattr(user, "clinic_id") or not user.clinic_id:
        return None

    return user.clinic_id


def require_financial_access():
    current_user = get_current_user()

    if not current_user:
        return None, (jsonify({"msg": "User tidak ditemukan."}), 404)

    if not current_user.is_active:
        return None, (jsonify({"msg": "Akun Anda sedang tidak aktif."}), 403)

    current_role = role_to_text(current_user.user_role)

    if current_role not in FINANCIAL_ALLOWED_ROLES:
        return None, (
            jsonify(
                {
                    "msg": "Akses ditolak. Hanya admin dan bidan yang dapat mengakses laporan keuangan."
                }
            ),
            403,
        )

    if is_midwife_user(current_user) and not current_user.clinic_id:
        return None, (
            jsonify(
                {
                    "msg": "Akun bidan belum terhubung dengan klinik.",
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                }
            ),
            400,
        )

    return current_user, None


def parse_payment_date(value):
    if not value:
        return None

    raw_value = str(value).strip()

    if "T" in raw_value:
        raw_value = raw_value.split("T")[0]

    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError("Format tanggal tidak valid. Gunakan format YYYY-MM-DD.")


def format_date(value):
    if not value:
        return None

    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")

    raw_value = str(value)

    if "T" in raw_value:
        return raw_value.split("T")[0]

    if " " in raw_value:
        return raw_value.split(" ")[0]

    return raw_value


def parse_amount(value, allow_zero=False):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("Nominal harus berupa angka yang valid.")

    if allow_zero:
        if amount < 0:
            raise ValueError("Nominal tidak boleh negatif.")
    else:
        if amount <= 0:
            raise ValueError("Nominal harus lebih besar dari 0.")

    return amount


def is_income_type(trans_type):
    return str(trans_type or "").strip().lower() in ("pemasukan",)


def is_expense_type(trans_type):
    return str(trans_type or "").strip().lower() in ("pengeluaran",)


def normalize_status_text(value):
    if value is None:
        return ""

    return str(value).strip().lower()


PAID_STATUS_ALIASES = {
    "paid",
    "lunas",
    "terbayar",
    "dibayar",
    "sudah dibayar",
    "sudah terbayar",
}

UNPAID_STATUS_ALIASES = {
    "unpaid",
    "belum terbayar",
    "pending",
    "draft",
    "menunggu pembayaran",
}


def is_paid_status(value):
    return normalize_status_text(value) in PAID_STATUS_ALIASES


def is_unpaid_status(value):
    return normalize_status_text(value) in UNPAID_STATUS_ALIASES


# -----------------------------------------------------------------------------
# PostgreSQL enum helpers
# -----------------------------------------------------------------------------
def quote_identifier(identifier):
    return '"' + str(identifier).replace('"', '""') + '"'


def get_enum_labels(type_name):
    rows = db.session.execute(
        text(
            """
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e
                ON t.oid = e.enumtypid
            WHERE t.typname = :type_name
            ORDER BY e.enumsortorder
            """
        ),
        {"type_name": type_name},
    ).all()

    return [row[0] for row in rows]


def get_column_enum_labels(table_name, column_name, schema_name="public"):
    rows = db.session.execute(
        text(
            """
            SELECT e.enumlabel
            FROM pg_attribute a
            JOIN pg_class c
                ON c.oid = a.attrelid
            JOIN pg_namespace table_namespace
                ON table_namespace.oid = c.relnamespace
            JOIN pg_type t
                ON t.oid = a.atttypid
            JOIN pg_enum e
                ON e.enumtypid = t.oid
            WHERE table_namespace.nspname = :schema_name
              AND c.relname = :table_name
              AND a.attname = :column_name
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY e.enumsortorder
            """
        ),
        {
            "schema_name": schema_name,
            "table_name": table_name,
            "column_name": column_name,
        },
    ).all()

    return [row[0] for row in rows]


def get_column_db_type_name(table_name, column_name, schema_name="public"):
    row = db.session.execute(
        text(
            """
            SELECT
                type_namespace.nspname AS type_schema,
                column_type.typname AS type_name
            FROM pg_attribute column_attribute
            JOIN pg_class table_class
                ON table_class.oid = column_attribute.attrelid
            JOIN pg_namespace table_namespace
                ON table_namespace.oid = table_class.relnamespace
            JOIN pg_type column_type
                ON column_type.oid = column_attribute.atttypid
            JOIN pg_namespace type_namespace
                ON type_namespace.oid = column_type.typnamespace
            WHERE table_namespace.nspname = :schema_name
              AND table_class.relname = :table_name
              AND column_attribute.attname = :column_name
              AND column_attribute.attnum > 0
              AND NOT column_attribute.attisdropped
            """
        ),
        {
            "schema_name": schema_name,
            "table_name": table_name,
            "column_name": column_name,
        },
    ).mappings().first()

    if not row:
        raise ValueError(
            f"Kolom {schema_name}.{table_name}.{column_name} tidak ditemukan."
        )

    return f"{quote_identifier(row['type_schema'])}.{quote_identifier(row['type_name'])}"


def normalize_column_enum_value(table_name, column_name, value, allowed_fallback=None):
    if value is None:
        raise ValueError(f"{column_name} wajib diisi.")

    raw_value = str(value).strip()

    if not raw_value:
        raise ValueError(f"{column_name} wajib diisi.")

    enum_labels = get_column_enum_labels(table_name, column_name)

    if not enum_labels and allowed_fallback:
        enum_labels = allowed_fallback

    if not enum_labels:
        return raw_value

    for label in enum_labels:
        if label == raw_value:
            return label

    for label in enum_labels:
        if label.lower() == raw_value.lower():
            return label

    allowed_values = ", ".join(enum_labels)

    raise ValueError(
        f"Nilai '{raw_value}' tidak valid untuk {column_name}. Nilai yang tersedia: {allowed_values}."
    )


def get_financial_enum_type_names():
    return {
        "trans_type": get_column_db_type_name("financial", "trans_type"),
        "payment_method": get_column_db_type_name("financial", "payment_method"),
        "status": get_column_db_type_name("financial", "status"),
    }


def normalize_financial_input(data, include_required=True):
    base_required_fields = [
        "payment_date",
        "trans_type",
        "status",
    ]

    if include_required:
        missing_fields = [
            field
            for field in base_required_fields
            if data.get(field) is None or data.get(field) == ""
        ]

        if missing_fields:
            raise ValueError(
                "Data wajib belum lengkap: " + ", ".join(missing_fields)
            )

    payment_date = parse_payment_date(data.get("payment_date"))

    trans_type = normalize_column_enum_value(
        "financial",
        "trans_type",
        data.get("trans_type"),
        ["pemasukan", "pengeluaran"],
    )

    status = normalize_column_enum_value(
        "financial",
        "status",
        data.get("status"),
        ["paid", "unpaid"],
    )

    description = (data.get("description") or "").strip()

    if str(status).lower() == "unpaid":
        return {
            "payment_date": payment_date,
            "trans_type": trans_type,
            "amount": Decimal("0"),
            "payment_method": None,
            "status": status,
            "description": description,
        }

    if data.get("amount") is None or data.get("amount") == "":
        raise ValueError("Nominal wajib diisi jika status pembayaran dibayar.")

    if data.get("payment_method") is None or data.get("payment_method") == "":
        raise ValueError("Metode pembayaran wajib diisi jika status pembayaran dibayar.")

    amount = parse_amount(data.get("amount"))

    payment_method = normalize_column_enum_value(
        "financial",
        "payment_method",
        data.get("payment_method"),
        ["Transfer", "QRIS", "Cash"],
    )

    return {
        "payment_date": payment_date,
        "trans_type": trans_type,
        "amount": amount,
        "payment_method": payment_method,
        "status": status,
        "description": description,
    }


# -----------------------------------------------------------------------------
# Visit / record reference helpers
# -----------------------------------------------------------------------------
def resolve_visit_or_record_reference(reference_id, clinic_id=None):
    if not reference_id:
        return None

    reference_id = str(reference_id).strip()

    visit_conditions = ["vm.visit_id::text = :reference_id"]
    visit_params = {"reference_id": reference_id}

    if clinic_id:
        visit_conditions.append("p.clinic_id::text = :clinic_id")
        visit_params["clinic_id"] = str(clinic_id)

    visit_row = db.session.execute(
        text(
            f"""
            SELECT
                vm.visit_id::text AS visit_id,
                vm.visit_number,
                vm.record_id::text AS record_id,
                mr.record_number,
                mr.record_type::text AS record_type,
                p.patient_id::text AS patient_id,
                p.clinic_id::text AS clinic_id,
                p.patient_name
            FROM visit_master vm
            JOIN medical_record mr
                ON mr.record_id::text = vm.record_id::text
            JOIN patient p
                ON p.patient_id::text = mr.patient_id::text
            WHERE {' AND '.join(visit_conditions)}
            """
        ),
        visit_params,
    ).mappings().first()

    if visit_row:
        return dict(visit_row)

    record_conditions = ["mr.record_id::text = :reference_id"]
    record_params = {"reference_id": reference_id}

    if clinic_id:
        record_conditions.append("p.clinic_id::text = :clinic_id")
        record_params["clinic_id"] = str(clinic_id)

    record_row = db.session.execute(
        text(
            f"""
            SELECT
                NULL::text AS visit_id,
                NULL::text AS visit_number,
                mr.record_id::text AS record_id,
                mr.record_number,
                mr.record_type::text AS record_type,
                p.patient_id::text AS patient_id,
                p.clinic_id::text AS clinic_id,
                p.patient_name
            FROM medical_record mr
            JOIN patient p
                ON p.patient_id::text = mr.patient_id::text
            WHERE {' AND '.join(record_conditions)}
            """
        ),
        record_params,
    ).mappings().first()

    if not record_row:
        return None

    resolved_row = dict(record_row)

    latest_visit = db.session.execute(
        text(
            """
            SELECT
                vm.visit_id::text AS visit_id,
                vm.visit_number
            FROM visit_master vm
            WHERE vm.record_id::text = :record_id
            ORDER BY
                vm.visit_date DESC NULLS LAST,
                vm.visit_time DESC NULLS LAST,
                vm.visit_number DESC
            LIMIT 1
            """
        ),
        {"record_id": resolved_row["record_id"]},
    ).mappings().first()

    if latest_visit:
        resolved_row["visit_id"] = latest_visit.get("visit_id")
        resolved_row["visit_number"] = latest_visit.get("visit_number")

    return resolved_row


def has_paid_financial_for_visit(visit_id, clinic_id=None, exclude_transaction_id=None):
    if not visit_id:
        return False

    conditions = [
        "f.visit_id::text = :visit_id",
        "LOWER(TRIM(f.status::text)) = ANY(:paid_statuses)",
    ]

    params = {
        "visit_id": str(visit_id),
        "paid_statuses": list(PAID_STATUS_ALIASES),
    }

    if clinic_id:
        conditions.append("f.clinic_id::text = :clinic_id")
        params["clinic_id"] = str(clinic_id)

    if exclude_transaction_id:
        conditions.append("f.transaction_id::text <> :exclude_transaction_id")
        params["exclude_transaction_id"] = str(exclude_transaction_id)

    row = db.session.execute(
        text(
            f"""
            SELECT 1
            FROM financial f
            WHERE {' AND '.join(conditions)}
            LIMIT 1
            """
        ),
        params,
    ).first()

    return row is not None


def serialize_unpaid_visit_row(row):
    if not row:
        return {}

    encrypted_patient_name = row.get("patient_name")
    patient_name = safe_decrypt(encrypted_patient_name) if encrypted_patient_name else "-"

    encrypted_patient_number = row.get("patient_number")
    patient_number = safe_decrypt(encrypted_patient_number) if encrypted_patient_number else "-"

    latest_status = row.get("billing_status")
    normalized_status = normalize_status_text(latest_status)

    if not latest_status:
        billing_status = "belum terbayar"
    elif is_paid_status(latest_status):
        billing_status = latest_status
    elif normalized_status in UNPAID_STATUS_ALIASES:
        billing_status = latest_status
    else:
        billing_status = latest_status or "belum terbayar"

    visit_display = (
        row.get("visit_number")
        or row.get("record_number")
        or row.get("visit_id")
        or "-"
    )

    return {
        "visit_id": row.get("visit_id"),
        "visit_number": row.get("visit_number") or "-",
        "visit_date": format_date(row.get("visit_date")),
        "visit_time": format_date(row.get("visit_time")),
        "visit_display": visit_display,
        "record_id": row.get("record_id"),
        "record_number": row.get("record_number") or "-",
        "record_type": row.get("record_type") or "-",
        "patient_id": row.get("patient_id"),
        "patient_name": patient_name or "-",
        "patient_number": patient_number or "-",
        "clinic_id": row.get("clinic_id"),
        "billing_transaction_id": row.get("billing_transaction_id"),
        "billing_transaction_number": row.get("billing_transaction_number") or "-",
        "billing_status": billing_status,
        "billing_amount": float(row.get("billing_amount") or 0),
        "billing_payment_date": format_date(row.get("billing_payment_date")),
    }


# -----------------------------------------------------------------------------
# Shared select / serialization
# -----------------------------------------------------------------------------
FINANCIAL_SELECT_QUERY = """
    SELECT
        f.transaction_id::text AS transaction_id,
        f.visit_id::text AS visit_id,
        f.user_id::text AS user_id,
        f.patient_id::text AS patient_id,
        f.clinic_id::text AS clinic_id,
        f.transaction_number,
        f.trans_type::text AS trans_type,
        f.amount,
        f.payment_method::text AS payment_method,
        f.status::text AS status,
        f.payment_date,
        f.description,

        vm.visit_number,
        vm.visit_date,
        vm.visit_time,
        vm.record_id::text AS record_id,

        mr.record_number,
        mr.record_type::text AS record_type,

        p.patient_name,
        p.patient_number,
        p.clinic_id::text AS patient_clinic_id,

        u.fullname AS user_name,
        u.clinic_id::text AS user_clinic_id
    FROM financial f
    LEFT JOIN visit_master vm ON vm.visit_id = f.visit_id
    LEFT JOIN medical_record mr ON mr.record_id = vm.record_id
    LEFT JOIN patient p ON p.patient_id = COALESCE(f.patient_id, mr.patient_id)
    LEFT JOIN users u ON u.user_id = f.user_id
"""


def serialize_financial_row(row):
    if not row:
        return {}

    encrypted_patient_name = row.get("patient_name")
    patient_name = safe_decrypt(encrypted_patient_name) if encrypted_patient_name else "-"

    encrypted_patient_number = row.get("patient_number")
    patient_number = safe_decrypt(encrypted_patient_number) if encrypted_patient_number else "-"

    payment_date = format_date(row.get("payment_date"))

    visit_display = (
        row.get("visit_number")
        or row.get("record_number")
        or row.get("visit_id")
        or "-"
    )

    payment_method = row.get("payment_method")
    description = row.get("description")

    return {
        "transaction_id": row.get("transaction_id"),
        "visit_id": row.get("visit_id"),
        "user_id": row.get("user_id"),
        "patient_id": row.get("patient_id"),
        "clinic_id": row.get("clinic_id")
        or row.get("patient_clinic_id")
        or row.get("user_clinic_id"),
        "transaction_number": row.get("transaction_number"),
        "trans_id": payment_date,
        "payment_date": payment_date,
        "trans_type": row.get("trans_type"),
        "amount": float(row.get("amount") or 0),
        "payment_method": payment_method or "",
        "status": row.get("status"),
        "description": safe_decrypt(description) if description else "",
        "visit_display": visit_display,
        "visit_number": row.get("visit_number") or "-",
        "visit_date": format_date(row.get("visit_date")),
        "record_id": row.get("record_id"),
        "record_number": row.get("record_number") or "-",
        "record_type": row.get("record_type") or "-",
        "patient_name": patient_name or "-",
        "patient_number": patient_number or "-",
        "user_name": row.get("user_name") or "-",
    }


def fetch_financial_by_transaction_id(transaction_id, clinic_id=None):
    conditions = ["f.transaction_id::text = :transaction_id"]
    params = {"transaction_id": str(transaction_id)}

    if clinic_id:
        conditions.append("f.clinic_id::text = :clinic_id")
        params["clinic_id"] = str(clinic_id)

    where_clause = "WHERE " + " AND ".join(conditions)

    row = db.session.execute(
        text(
            f"""
            {FINANCIAL_SELECT_QUERY}
            {where_clause}
            """
        ),
        params,
    ).mappings().first()

    return row


def get_month_bounds(reference=None):
    today = reference or date.today()
    month_start = today.replace(day=1)

    if today.month == 12:
        month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

    return month_start, month_end


def build_daily_financial_series(clinic_id, month_start, month_end):
    conditions = [
        "CAST(f.payment_date AS date) >= :month_start",
        "CAST(f.payment_date AS date) <= :month_end",
    ]

    params = {
        "month_start": month_start,
        "month_end": month_end,
    }

    if clinic_id:
        conditions.append("f.clinic_id::text = :clinic_id")
        params["clinic_id"] = str(clinic_id)

    rows = db.session.execute(
        text(
            f"""
            SELECT
                CAST(f.payment_date AS date) AS payment_day,
                LOWER(f.trans_type::text) AS trans_type,
                COALESCE(SUM(f.amount), 0) AS total
            FROM financial f
            WHERE {' AND '.join(conditions)}
            GROUP BY CAST(f.payment_date AS date), f.trans_type
            ORDER BY payment_day
            """
        ),
        params,
    ).mappings().all()

    income_by_day = {}
    expense_by_day = {}

    current = month_start

    while current <= month_end:
        day_key = current.isoformat()
        income_by_day[day_key] = 0.0
        expense_by_day[day_key] = 0.0
        current += timedelta(days=1)

    for row in rows:
        day_key = row["payment_day"].isoformat()
        total = float(row.get("total") or 0)
        trans_type = str(row.get("trans_type") or "").strip().lower()

        if is_income_type(trans_type):
            income_by_day[day_key] = income_by_day.get(day_key, 0.0) + total
        elif is_expense_type(trans_type):
            expense_by_day[day_key] = expense_by_day.get(day_key, 0.0) + total

    daily_income = [
        {"date": day, "amount": income_by_day[day]}
        for day in sorted(income_by_day.keys())
    ]
    daily_expense = [
        {"date": day, "amount": expense_by_day[day]}
        for day in sorted(expense_by_day.keys())
    ]

    return daily_income, daily_expense


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@financial_bp.route("/transaction-number", methods=["GET"])
@jwt_required()
def get_transaction_number():
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    try:
        requested_clinic_id = normalize_optional_uuid(request.args.get("clinic_id"))
        clinic_id = requested_clinic_id if is_admin_user(current_user) else current_user.clinic_id

        if not clinic_id:
            return (
                jsonify(
                    {
                        "msg": "Klinik untuk nomor transaksi belum tersedia. Jika admin membuat invoice manual, pilih laporan kunjungan terlebih dahulu atau kirim clinic_id."
                    }
                ),
                400,
            )

        date_param = request.args.get("date")
        year_param = request.args.get("year")

        if date_param:
            payment_date = parse_payment_date(date_param)
            year = payment_date.year
        elif year_param:
            year = int(year_param)
        else:
            year = datetime.utcnow().year

        next_number = get_next_sequence_preview(year, clinic_id)
        transaction_number = generate_financial_number(year, next_number)

        return (
            jsonify(
                {
                    "transaction_number": transaction_number,
                    "year": year,
                    "next_number": next_number,
                }
            ),
            200,
        )

    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal membuat nomor transaksi.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/monthly-summary", methods=["GET"])
@jwt_required()
def get_monthly_summary():
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    try:
        current_clinic_id = get_financial_scope_clinic_id(current_user)
        month_start, month_end = get_month_bounds()

        conditions = [
            "CAST(f.payment_date AS date) >= :month_start",
            "CAST(f.payment_date AS date) <= :month_end",
        ]

        params = {
            "month_start": month_start,
            "month_end": month_end,
        }

        if current_clinic_id:
            conditions.append("f.clinic_id::text = :clinic_id")
            params["clinic_id"] = str(current_clinic_id)

        rows = db.session.execute(
            text(
                f"""
                SELECT
                    LOWER(f.trans_type::text) AS trans_type,
                    COALESCE(SUM(f.amount), 0) AS total
                FROM financial f
                WHERE {' AND '.join(conditions)}
                GROUP BY f.trans_type
                """
            ),
            params,
        ).mappings().all()

        # calculate monthly income and expense
        monthly_income = 0.0
        monthly_expense = 0.0

        for row in rows:
            trans_type = str(row.get("trans_type") or "").strip().lower()
            total = float(row.get("total") or 0)

            if is_income_type(trans_type):
                monthly_income += total
            elif is_expense_type(trans_type):
                monthly_expense += total

        daily_income, daily_expense = build_daily_financial_series(
            current_clinic_id,
            month_start,
            month_end,
        )

        return (
            jsonify(
                {
                    "month": month_start.strftime("%Y-%m"),
                    "monthly_income": monthly_income,
                    "monthly_expense": monthly_expense,
                    "daily_income": daily_income,
                    "daily_expense": daily_expense,
                }
            ),
            200,
        )

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal mengambil ringkasan keuangan bulanan.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/get-all", methods=["GET"])
@jwt_required()
def get_all_financial_transactions():
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    try:
        current_clinic_id = get_financial_scope_clinic_id(current_user)

        date_filter = request.args.get("date")
        search_query = request.args.get("search", "").strip()

        conditions = []
        params = {}

        if current_clinic_id:
            conditions.append("f.clinic_id = :clinic_id")
            params["clinic_id"] = current_clinic_id

        if date_filter:
            conditions.append("CAST(f.payment_date AS date) = :payment_date")
            params["payment_date"] = parse_payment_date(date_filter)

        if search_query:
            conditions.append(
                """
                (
                    LOWER(COALESCE(f.transaction_number, '')) LIKE :search
                    OR LOWER(COALESCE(vm.visit_number, '')) LIKE :search
                    OR LOWER(COALESCE(mr.record_number, '')) LIKE :search
                    OR LOWER(COALESCE(mr.record_type::text, '')) LIKE :search
                    OR LOWER(COALESCE(f.trans_type::text, '')) LIKE :search
                    OR LOWER(COALESCE(f.payment_method::text, '')) LIKE :search
                    OR LOWER(COALESCE(f.status::text, '')) LIKE :search
                    OR LOWER(COALESCE(CAST(f.amount AS text), '')) LIKE :search
                    OR LOWER(COALESCE(u.fullname, '')) LIKE :search
                )
                """
            )
            params["search"] = f"%{search_query.lower()}%"

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        rows = db.session.execute(
            text(
                f"""
                {FINANCIAL_SELECT_QUERY}
                {where_clause}
                ORDER BY f.payment_date DESC, f.transaction_number DESC
                """
            ),
            params,
        ).mappings().all()

        return jsonify([serialize_financial_row(row) for row in rows]), 200

    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal mengambil data keuangan.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/unpaid-visits", methods=["GET"])
@jwt_required()
def get_unpaid_visits():
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    try:
        requested_clinic_id = normalize_optional_uuid(request.args.get("clinic_id"))
        current_clinic_id = get_financial_scope_clinic_id(current_user)
        scope_clinic_id = (
            requested_clinic_id
            if is_admin_user(current_user) and requested_clinic_id
            else current_clinic_id
        )

        date_filter = request.args.get("date")
        search_query = request.args.get("search", "").strip()
        limit_raw = request.args.get("limit", 100)

        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            limit = 100

        limit = max(1, min(limit, 500))

        conditions = [
            """
            NOT EXISTS (
                SELECT 1
                FROM financial paid_financial
                WHERE paid_financial.visit_id = vm.visit_id
                  AND LOWER(TRIM(paid_financial.status::text)) = ANY(:paid_statuses)
            )
            """
        ]

        params = {
            "paid_statuses": list(PAID_STATUS_ALIASES),
            "limit": limit,
        }

        if scope_clinic_id:
            conditions.append("vm.clinic_id::text = :clinic_id")
            params["clinic_id"] = str(scope_clinic_id)

        if date_filter:
            conditions.append("CAST(vm.visit_date AS date) = :visit_date")
            params["visit_date"] = parse_payment_date(date_filter)

        if search_query:
            conditions.append(
                """
                (
                    LOWER(COALESCE(vm.visit_number, '')) LIKE :search
                    OR LOWER(COALESCE(mr.record_number, '')) LIKE :search
                    OR LOWER(COALESCE(mr.record_type::text, '')) LIKE :search
                )
                """
            )
            params["search"] = f"%{search_query.lower()}%"

        rows = db.session.execute(
            text(
                f"""
                SELECT
                    vm.visit_id::text AS visit_id,
                    vm.visit_number,
                    vm.visit_date,
                    vm.visit_time,
                    vm.record_id::text AS record_id,
                    vm.clinic_id::text AS clinic_id,

                    mr.record_number,
                    mr.record_type::text AS record_type,

                    p.patient_id::text AS patient_id,
                    p.patient_name,
                    p.patient_number,

                    latest_financial.transaction_id::text AS billing_transaction_id,
                    latest_financial.transaction_number AS billing_transaction_number,
                    latest_financial.status::text AS billing_status,
                    latest_financial.amount AS billing_amount,
                    latest_financial.payment_date AS billing_payment_date
                FROM visit_master vm
                JOIN medical_record mr
                    ON mr.record_id = vm.record_id
                JOIN patient p
                    ON p.patient_id = mr.patient_id
                LEFT JOIN LATERAL (
                    SELECT
                        f.transaction_id,
                        f.transaction_number,
                        f.status,
                        f.amount,
                        f.payment_date
                    FROM financial f
                    WHERE f.visit_id = vm.visit_id
                    ORDER BY
                        f.payment_date DESC NULLS LAST,
                        f.transaction_number DESC
                    LIMIT 1
                ) latest_financial ON TRUE
                WHERE {' AND '.join(conditions)}
                ORDER BY
                    vm.visit_date DESC NULLS LAST,
                    vm.visit_time DESC NULLS LAST,
                    vm.visit_number DESC
                LIMIT :limit
                """
            ),
            params,
        ).mappings().all()

        return (
            jsonify(
                {
                    "data": [serialize_unpaid_visit_row(row) for row in rows],
                    "count": len(rows),
                }
            ),
            200,
        )

    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal mengambil laporan kunjungan yang belum terbayar.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/add", methods=["POST"])
@jwt_required()
def add_financial_transaction():
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    current_user_id = current_user.user_id
    scope_clinic_id = get_financial_scope_clinic_id(current_user)

    data = request.get_json() or {}

    required_fields = [
        "payment_date",
        "trans_type",
        "status",
    ]

    missing_fields = [
        field
        for field in required_fields
        if data.get(field) is None or data.get(field) == ""
    ]

    if missing_fields:
        return (
            jsonify(
                {
                    "msg": "Data wajib belum lengkap.",
                    "missing_fields": missing_fields,
                }
            ),
            400,
        )

    try:
        normalized_data = normalize_financial_input(data)

        reference_id = normalize_optional_uuid(
            data.get("visit_id")
            or data.get("record_id")
            or data.get("reference_id")
        )

        resolved_reference = None
        visit_id = None
        patient_id = None
        transaction_clinic_id = None

        if reference_id:
            resolved_reference = resolve_visit_or_record_reference(
                reference_id,
                scope_clinic_id,
            )

            if not resolved_reference:
                return jsonify({"msg": "Laporan kunjungan atau rekam medis tidak ditemukan."}), 404

            visit_id = normalize_optional_uuid(resolved_reference.get("visit_id"))
            patient_id = normalize_optional_uuid(resolved_reference.get("patient_id"))
            transaction_clinic_id = (
                normalize_optional_uuid(resolved_reference.get("clinic_id"))
                or normalize_optional_uuid(scope_clinic_id)
            )
        else:
            transaction_clinic_id = normalize_optional_uuid(current_user.clinic_id)

            if not transaction_clinic_id:
                return (
                    jsonify(
                        {
                            "msg": "Invoice manual membutuhkan klinik. Silakan login sebagai bidan yang sudah memiliki klinik atau pilih laporan kunjungan terlebih dahulu."
                        }
                    ),
                    400,
                )

        if not transaction_clinic_id:
            return jsonify({"msg": "Klinik untuk transaksi tidak ditemukan."}), 400

        if visit_id and has_paid_financial_for_visit(visit_id, transaction_clinic_id):
            return (
                jsonify(
                    {
                        "msg": "Laporan kunjungan ini sudah memiliki billing berstatus terbayar/lunas. Pilih laporan kunjungan lain yang belum terbayar."
                    }
                ),
                409,
            )

        year = normalized_data["payment_date"].year
        sequence_number = reserve_next_sequence(year, transaction_clinic_id)
        transaction_number = generate_financial_number(year, sequence_number)
        transaction_id = str(uuid.uuid4())

        enum_types = get_financial_enum_type_names()

        db.session.execute(
            text(
                f"""
                INSERT INTO financial (
                    transaction_id,
                    visit_id,
                    user_id,
                    patient_id,
                    clinic_id,
                    transaction_number,
                    trans_type,
                    amount,
                    payment_method,
                    status,
                    payment_date,
                    description
                )
                VALUES (
                    CAST(:transaction_id AS uuid),
                    CAST(:visit_id AS uuid),
                    CAST(:user_id AS uuid),
                    CAST(:patient_id AS uuid),
                    CAST(:clinic_id AS uuid),
                    :transaction_number,
                    CAST(:trans_type AS {enum_types['trans_type']}),
                    :amount,
                    CAST(:payment_method AS {enum_types['payment_method']}),
                    CAST(:status AS {enum_types['status']}),
                    :payment_date,
                    :description
                )
                """
            ),
            {
                "transaction_id": transaction_id,
                "visit_id": visit_id,
                "user_id": str(current_user_id),
                "patient_id": patient_id,
                "clinic_id": str(transaction_clinic_id),
                "transaction_number": transaction_number,
                "trans_type": normalized_data["trans_type"],
                "amount": normalized_data["amount"],
                "payment_method": normalized_data["payment_method"],
                "status": normalized_data["status"],
                "payment_date": normalized_data["payment_date"],
                "description": normalized_data["description"],
            },
        )

        fetch_scope_clinic_id = None if is_admin_user(current_user) else transaction_clinic_id
        saved_row = fetch_financial_by_transaction_id(
            transaction_id,
            fetch_scope_clinic_id,
        )
        saved_data = serialize_financial_row(saved_row)

        if not reference_id:
            saved_data["visit_display"] = "Transaksi Manual"
            saved_data["visit_number"] = "-"
            saved_data["record_number"] = "-"
            saved_data["record_type"] = "-"
            saved_data["patient_name"] = "-"
            saved_data["patient_number"] = "-"

        write_audit_log(
            user_id=current_user_id,
            action="ADD_INVOICE",
            old_values={},
            new_values={
                "module": "Financial",
                **saved_data,
                "manual_transaction": not bool(reference_id),
            },
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Transaksi keuangan berhasil ditambahkan.",
                    "data": saved_data,
                }
            ),
            201,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except IntegrityError as e:
        db.session.rollback()
        return (
            jsonify(
                {
                    "msg": "Nomor transaksi sudah digunakan. Silakan coba lagi.",
                    "error": str(e),
                }
            ),
            409,
        )

    except Exception as e:
        db.session.rollback()
        return (
            jsonify(
                {
                    "msg": "Gagal menambahkan transaksi keuangan.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/detail/<transaction_id>", methods=["GET"])
@jwt_required()
def get_financial_detail(transaction_id):
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    try:
        current_clinic_id = get_financial_scope_clinic_id(current_user)
        row = fetch_financial_by_transaction_id(transaction_id, current_clinic_id)

        if not row:
            return jsonify({"msg": "Invoice tidak ditemukan."}), 404

        return jsonify({"data": serialize_financial_row(row)}), 200

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Gagal mengambil detail invoice.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/detail/<transaction_id>", methods=["PATCH"])
@jwt_required()
def update_financial_detail(transaction_id):
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    data = request.get_json() or {}

    try:
        current_clinic_id = get_financial_scope_clinic_id(current_user)
        current_row = fetch_financial_by_transaction_id(
            transaction_id,
            current_clinic_id,
        )

        if not current_row:
            return jsonify({"msg": "Invoice tidak ditemukan."}), 404

        old_data = serialize_financial_row(current_row)
        normalized_data = normalize_financial_input(data)
        enum_types = get_financial_enum_type_names()

        conditions = ["transaction_id::text = :transaction_id"]
        params = {
            "transaction_id": str(transaction_id),
            "payment_date": normalized_data["payment_date"],
            "trans_type": normalized_data["trans_type"],
            "amount": normalized_data["amount"],
            "payment_method": normalized_data["payment_method"],
            "status": normalized_data["status"],
            "description": normalized_data["description"],
        }

        if current_clinic_id:
            conditions.append("clinic_id::text = :clinic_id")
            params["clinic_id"] = str(current_clinic_id)

        db.session.execute(
            text(
                f"""
                UPDATE financial
                SET
                    payment_date = :payment_date,
                    trans_type = CAST(:trans_type AS {enum_types['trans_type']}),
                    amount = :amount,
                    payment_method = CAST(:payment_method AS {enum_types['payment_method']}),
                    status = CAST(:status AS {enum_types['status']}),
                    description = :description
                WHERE {' AND '.join(conditions)}
                """
            ),
            params,
        )

        updated_row = fetch_financial_by_transaction_id(
            transaction_id,
            current_clinic_id,
        )
        updated_data = serialize_financial_row(updated_row)

        write_audit_log(
            user_id=current_user.user_id,
            action="UPDATE_INVOICE",
            old_values={
                "module": "Financial",
                **old_data,
            },
            new_values={
                "module": "Financial",
                **updated_data,
            },
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Invoice berhasil diperbarui.",
                    "data": updated_data,
                }
            ),
            200,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return (
            jsonify(
                {
                    "msg": "Gagal memperbarui invoice.",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/detail/<transaction_id>", methods=["DELETE"])
@jwt_required()
def delete_financial_detail(transaction_id):
    current_user, error_response = require_financial_access()

    if error_response:
        return error_response

    try:
        current_clinic_id = get_financial_scope_clinic_id(current_user)
        current_row = fetch_financial_by_transaction_id(
            transaction_id,
            current_clinic_id,
        )

        if not current_row:
            return jsonify({"msg": "Invoice tidak ditemukan."}), 404

        old_data = serialize_financial_row(current_row)

        conditions = ["transaction_id::text = :transaction_id"]
        params = {"transaction_id": str(transaction_id)}

        if current_clinic_id:
            conditions.append("clinic_id::text = :clinic_id")
            params["clinic_id"] = str(current_clinic_id)

        db.session.execute(
            text(
                f"""
                DELETE FROM financial
                WHERE {' AND '.join(conditions)}
                """
            ),
            params,
        )

        write_audit_log(
            user_id=current_user.user_id,
            action="DELETE_INVOICE",
            old_values={
                "module": "Financial",
                **old_data,
            },
            new_values={},
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Invoice berhasil dihapus.",
                    "data": old_data,
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return (
            jsonify(
                {
                    "msg": "Gagal menghapus invoice.",
                    "error": str(e),
                }
            ),
            500,
        )