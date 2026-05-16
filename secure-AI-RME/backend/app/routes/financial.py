from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User
from app.utils import decrypt_data, generate_financial_number, write_audit_log, reserve_next_sequence, get_next_sequence_preview
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import uuid


financial_bp = Blueprint("financial", __name__)

FINANCIAL_ALLOWED_ROLES = ["admin", "midwife"]


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
        return str(value.value)

    return str(value)


def safe_decrypt(value):
    if value is None:
        return ""

    try:
        return decrypt_data(value)
    except Exception:
        return str(value)


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_financial_access():
    current_user = get_current_user()

    if not current_user:
        return None, (jsonify({"msg": "User not found"}), 404)

    if not current_user.is_active:
        return None, (jsonify({"msg": "Your account is inactive"}), 403)

    current_role = role_to_text(current_user.user_role)

    if current_role not in FINANCIAL_ALLOWED_ROLES:
        return None, (
            jsonify(
                {
                    "msg": "Access denied. Only admin and midwife can access financial report."
                }
            ),
            403,
        )

    if not current_user.clinic_id:
        return None, (
            jsonify({"msg": "Your account is not linked to a clinic"}),
            400,
        )

    return current_user, None


def parse_payment_date(value):
    if not value:
        return None

    raw_value = str(value).strip()

    if "T" in raw_value:
        raw_value = raw_value.split("T")[0]

    return datetime.strptime(raw_value, "%Y-%m-%d").date()


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


def parse_amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("Amount must be a valid number")

    if amount <= 0:
        raise ValueError("Amount must be greater than 0")

    return amount


# -----------------------------------------------------------------------------
# PostgreSQL enum helpers
# Supabase exports USER-DEFINED for enum columns. The actual enum type name can
# differ between local DB and Supabase, so this file reads the DB type directly
# from the financial column before CAST-ing values.
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
        raise ValueError(f"Column {schema_name}.{table_name}.{column_name} was not found")

    return f"{quote_identifier(row['type_schema'])}.{quote_identifier(row['type_name'])}"


def normalize_column_enum_value(table_name, column_name, value, allowed_fallback=None):
    if value is None:
        raise ValueError(f"{column_name} is required")

    raw_value = str(value).strip()

    if not raw_value:
        raise ValueError(f"{column_name} is required")

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
        f"Invalid value '{raw_value}' for {column_name}. Allowed values: {allowed_values}"
    )

def get_financial_enum_type_names():
    return {
        "trans_type": get_column_db_type_name("financial", "trans_type"),
        "payment_method": get_column_db_type_name("financial", "payment_method"),
        "status": get_column_db_type_name("financial", "status"),
    }

def normalize_financial_input(data, include_required=True):
    required_fields = [
        "payment_date",
        "trans_type",
        "amount",
        "payment_method",
        "status",
    ]

    if include_required:
        missing_fields = [
            field
            for field in required_fields
            if data.get(field) is None or data.get(field) == ""
        ]

        if missing_fields:
            raise ValueError(
                "All required data must be filled: " + ", ".join(missing_fields)
            )

    payment_date = parse_payment_date(data.get("payment_date"))

    trans_type = normalize_column_enum_value(
        "financial",
        "trans_type",
        data.get("trans_type"),
        ["pemasukan", "pengeluaran"],
    )

    payment_method = normalize_column_enum_value(
        "financial",
        "payment_method",
        data.get("payment_method"),
        ["Transfer", "QRIS", "Cash"],
    )

    status = normalize_column_enum_value(
        "financial",
        "status",
        data.get("status"),
        ["paid", "unpaid"],
    )

    amount = parse_amount(data.get("amount"))
    description = (data.get("description") or "").strip()

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
def resolve_visit_or_record_reference(reference_id, clinic_id):
    if not reference_id:
        return None

    reference_id = str(reference_id).strip()

    visit_row = db.session.execute(
        text(
            """
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
            WHERE vm.visit_id::text = :reference_id
              AND p.clinic_id::text = :clinic_id
            """
        ),
        {
            "reference_id": reference_id,
            "clinic_id": str(clinic_id),
        },
    ).mappings().first()

    if visit_row:
        return dict(visit_row)

    record_row = db.session.execute(
        text(
            """
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
            WHERE mr.record_id::text = :reference_id
              AND p.clinic_id::text = :clinic_id
            """
        ),
        {
            "reference_id": reference_id,
            "clinic_id": str(clinic_id),
        },
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
    LEFT JOIN visit_master vm
        ON vm.visit_id::text = f.visit_id::text
    LEFT JOIN medical_record mr
        ON mr.record_id::text = vm.record_id::text
    LEFT JOIN patient p
        ON p.patient_id::text = COALESCE(f.patient_id::text, mr.patient_id::text)
    LEFT JOIN users u
        ON u.user_id::text = f.user_id::text
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

    return {
        "transaction_id": row.get("transaction_id"),
        "visit_id": row.get("visit_id"),
        "user_id": row.get("user_id"),
        "patient_id": row.get("patient_id"),
        "clinic_id": row.get("clinic_id") or row.get("patient_clinic_id") or row.get("user_clinic_id"),
        "transaction_number": row.get("transaction_number"),
        "trans_id": payment_date,
        "payment_date": payment_date,
        "trans_type": row.get("trans_type"),
        "amount": float(row.get("amount") or 0),
        "payment_method": row.get("payment_method"),
        "status": row.get("status"),
        "description": row.get("description") or "",
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
        date_param = request.args.get("date")
        year_param = request.args.get("year")

        if date_param:
            payment_date = parse_payment_date(date_param)
            year = payment_date.year
        elif year_param:
            year = int(year_param)
        else:
            year = datetime.utcnow().year

        next_number = get_next_sequence_preview(year)
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

    except ValueError:
        return jsonify({"msg": "Invalid date format. Use YYYY-MM-DD"}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Failed to generate transaction number",
                    "error": str(e),
                }
            ),
            500,
        )


@financial_bp.route("/monthly-summary", methods=["GET"])
@jwt_required()
def get_monthly_summary():
    current_user = get_current_user()

    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    if not current_user.clinic_id:
        return jsonify({"msg": "Akun belum terhubung ke klinik"}), 400

    try:
        month_start, month_end = get_month_bounds()

        rows = db.session.execute(
            text(
                """
                SELECT
                    LOWER(f.trans_type::text) AS trans_type,
                    COALESCE(SUM(f.amount), 0) AS total
                FROM financial f
                LEFT JOIN visit_master vm
                    ON vm.visit_id::text = f.visit_id::text
                LEFT JOIN medical_record mr
                    ON mr.record_id::text = vm.record_id::text
                LEFT JOIN patient p
                    ON p.patient_id::text = COALESCE(f.patient_id::text, mr.patient_id::text)
                LEFT JOIN users u
                    ON u.user_id::text = f.user_id::text
                WHERE (
                    p.clinic_id::text = :clinic_id
                    OR (
                        p.patient_id IS NULL
                        AND u.clinic_id::text = :clinic_id
                    )
                )
                AND CAST(f.payment_date AS date) >= :month_start
                AND CAST(f.payment_date AS date) <= :month_end
                GROUP BY f.trans_type
                """
            ),
            {
                "clinic_id": str(current_user.clinic_id),
                "month_start": month_start,
                "month_end": month_end,
            },
        ).mappings().all()

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
            current_user.clinic_id, month_start, month_end
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
                    "msg": "Gagal mengambil ringkasan keuangan bulanan",
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
        current_clinic_id = current_user.clinic_id

        date_filter = request.args.get("date")
        search_query = request.args.get("search", "").strip()

        conditions = ["f.clinic_id::text = :clinic_id"]

        params = {
            "clinic_id": str(current_clinic_id),
        }

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
                    OR LOWER(COALESCE(p.patient_number, '')) LIKE :search
                )
                """
            )
            params["search"] = f"%{search_query.lower()}%"

        where_clause = "WHERE " + " AND ".join(conditions)

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

    except ValueError:
        return jsonify({"msg": "Invalid date format. Use YYYY-MM-DD"}), 400

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Failed to get financial data",
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

    current_clinic_id = current_user.clinic_id
    current_user_id = current_user.user_id

    data = request.get_json() or {}

    required_fields = [
        "payment_date",
        "visit_id",
        "trans_type",
        "amount",
        "payment_method",
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
                    "msg": "All required data must be filled",
                    "missing_fields": missing_fields,
                }
            ),
            400,
        )

    try:
        reference_id = str(data.get("visit_id")).strip()
        normalized_data = normalize_financial_input(data)

        resolved_reference = resolve_visit_or_record_reference(
            reference_id,
            current_clinic_id,
        )

        if not resolved_reference:
            return jsonify({"msg": "Visit or medical record not found in your clinic"}), 404

        visit_id = resolved_reference.get("visit_id")
        patient_id = resolved_reference.get("patient_id")

        if not visit_id:
            return jsonify({"msg": "Selected medical record does not have a visit report"}), 400

        year = normalized_data["payment_date"].year
        sequence_number = reserve_next_sequence(year)
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
                "clinic_id": str(current_clinic_id),
                "transaction_number": transaction_number,
                "trans_type": normalized_data["trans_type"],
                "amount": normalized_data["amount"],
                "payment_method": normalized_data["payment_method"],
                "status": normalized_data["status"],
                "payment_date": normalized_data["payment_date"],
                "description": normalized_data["description"],
            },
        )

        saved_row = fetch_financial_by_transaction_id(transaction_id, current_clinic_id)
        saved_data = serialize_financial_row(saved_row)

        write_audit_log(
            user_id=current_user_id,
            action="ADD_INVOICE",
            old_values={},
            new_values={
                "module": "Financial",
                **saved_data,
            },
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Financial transaction added successfully",
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
                    "msg": "Transaction number already exists. Please try again.",
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
                    "msg": "Failed to add financial transaction",
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
        row = fetch_financial_by_transaction_id(transaction_id, current_user.clinic_id)

        if not row:
            return jsonify({"msg": "Invoice not found"}), 404

        return jsonify({"data": serialize_financial_row(row)}), 200

    except Exception as e:
        return (
            jsonify(
                {
                    "msg": "Failed to get invoice detail",
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
        current_row = fetch_financial_by_transaction_id(transaction_id, current_user.clinic_id)

        if not current_row:
            return jsonify({"msg": "Invoice not found"}), 404

        old_data = serialize_financial_row(current_row)
        normalized_data = normalize_financial_input(data)
        enum_types = get_financial_enum_type_names()

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
                WHERE transaction_id::text = :transaction_id
                  AND clinic_id::text = :clinic_id
                """
            ),
            {
                "transaction_id": str(transaction_id),
                "clinic_id": str(current_user.clinic_id),
                "payment_date": normalized_data["payment_date"],
                "trans_type": normalized_data["trans_type"],
                "amount": normalized_data["amount"],
                "payment_method": normalized_data["payment_method"],
                "status": normalized_data["status"],
                "description": normalized_data["description"],
            },
        )

        updated_row = fetch_financial_by_transaction_id(transaction_id, current_user.clinic_id)
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
                    "msg": "Invoice updated successfully",
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
                    "msg": "Failed to update invoice",
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
        current_row = fetch_financial_by_transaction_id(transaction_id, current_user.clinic_id)

        if not current_row:
            return jsonify({"msg": "Invoice not found"}), 404

        old_data = serialize_financial_row(current_row)

        db.session.execute(
            text(
                """
                DELETE FROM financial
                WHERE transaction_id::text = :transaction_id
                  AND clinic_id::text = :clinic_id
                """
            ),
            {
                "transaction_id": str(transaction_id),
                "clinic_id": str(current_user.clinic_id),
            },
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
                    "msg": "Invoice deleted successfully",
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
                    "msg": "Failed to delete invoice",
                    "error": str(e),
                }
            ),
            500,
        )
