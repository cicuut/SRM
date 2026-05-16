from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User
from app.utils import decrypt_data, generate_financial_number, write_audit_log
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import uuid


financial_bp = Blueprint("financial", __name__)

FINANCIAL_ALLOWED_ROLES = ["admin", "midwife"]

INCOME_TYPES = {"income"}
EXPENSE_TYPES = {"expense"}

# PostgreSQL enum `transaction_category` stores Indonesian labels
DB_CATEGORY_BY_APP = {"income": "pemasukan", "expense": "pengeluaran"}
APP_CATEGORY_BY_DB = {db: app for app, db in DB_CATEGORY_BY_APP.items()}


def resolve_app_category(trans_type: str) -> str | None:
    normalized = str(trans_type or "").strip().lower()

    if normalized in INCOME_TYPES:
        return "income"

    if normalized in EXPENSE_TYPES:
        return "expense"

    return APP_CATEGORY_BY_DB.get(normalized)


def to_db_category(app_category: str) -> str:
    normalized = str(app_category or "").strip().lower()
    return DB_CATEGORY_BY_APP.get(normalized, normalized)


def is_income_type(trans_type: str) -> bool:
    return resolve_app_category(trans_type) == "income"


def is_expense_type(trans_type: str) -> bool:
    return resolve_app_category(trans_type) == "expense"


def get_month_bounds(reference: date | None = None) -> tuple[date, date]:
    today = reference or date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)
    return month_start, month_end


def build_daily_financial_series(
    clinic_id: str, month_start: date, month_end: date
) -> tuple[list[dict], list[dict]]:
    rows = db.session.execute(
        text(
            """
            SELECT
                CAST(f.payment_date AS date) AS day,
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
            GROUP BY day, f.trans_type
            ORDER BY day
            """
        ),
        {
            "clinic_id": str(clinic_id),
            "month_start": month_start,
            "month_end": month_end,
        },
    ).mappings().all()

    income_by_day: dict[date, float] = {}
    expense_by_day: dict[date, float] = {}

    for row in rows:
        day = row.get("day")
        if day is None:
            continue
        if hasattr(day, "date"):
            day = day.date()
        trans_type = str(row.get("trans_type") or "").strip().lower()
        total = float(row.get("total") or 0)

        if is_income_type(trans_type):
            income_by_day[day] = income_by_day.get(day, 0.0) + total
        elif is_expense_type(trans_type):
            expense_by_day[day] = expense_by_day.get(day, 0.0) + total

    income_series: list[dict] = []
    expense_series: list[dict] = []
    current = month_start

    while current <= month_end:
        income_series.append(
            {
                "date": current.isoformat(),
                "amount": income_by_day.get(current, 0.0),
            }
        )
        expense_series.append(
            {
                "date": current.isoformat(),
                "amount": expense_by_day.get(current, 0.0),
            }
        )
        current += timedelta(days=1)

    return income_series, expense_series


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


def get_enum_labels(type_name):
    rows = db.session.execute(
        text(
            """
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = :type_name
            ORDER BY e.enumsortorder
            """
        ),
        {"type_name": type_name},
    ).all()

    return [row[0] for row in rows]


def normalize_enum_value(type_name, value):
    if value is None:
        raise ValueError(f"{type_name} is required")

    raw_value = str(value).strip()

    if not raw_value:
        raise ValueError(f"{type_name} is required")

    enum_labels = get_enum_labels(type_name)

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
        f"Invalid value '{raw_value}' for {type_name}. Allowed values: {allowed_values}"
    )


def get_max_existing_sequence(year):
    result = db.session.execute(
        text(
            """
            SELECT COALESCE(
                MAX(CAST(split_part(transaction_number, '-', 3) AS INTEGER)),
                0
            ) AS max_number
            FROM financial
            WHERE transaction_number ~ :pattern
            """
        ),
        {"pattern": f"^INV-{int(year)}-[0-9]+$"},
    ).scalar()

    return int(result or 0)


def get_next_sequence_preview(year):
    existing_max = get_max_existing_sequence(year)

    sequence_row = db.session.execute(
        text(
            """
            SELECT last_number
            FROM financial_sequence
            WHERE year = :year
            """
        ),
        {"year": int(year)},
    ).first()

    sequence_number = int(sequence_row[0]) if sequence_row else 0
    next_number = max(existing_max, sequence_number) + 1

    return next_number


def reserve_next_sequence(year):
    existing_max = get_max_existing_sequence(year)

    result = db.session.execute(
        text(
            """
            INSERT INTO financial_sequence (year, last_number)
            VALUES (:year, :next_number)
            ON CONFLICT (year)
            DO UPDATE SET last_number = GREATEST(
                financial_sequence.last_number,
                :existing_max
            ) + 1
            RETURNING last_number
            """
        ),
        {
            "year": int(year),
            "existing_max": int(existing_max),
            "next_number": int(existing_max) + 1,
        },
    )

    return int(result.scalar_one())


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


FINANCIAL_SELECT_QUERY = """
    SELECT
        f.transaction_id::text AS transaction_id,
        f.visit_id::text AS visit_id,
        f.user_id::text AS user_id,
        f.patient_id::text AS patient_id,
        f.transaction_number,
        f.trans_type::text AS trans_type,
        f.amount,
        f.payment_method::text AS payment_method,
        f.status::text AS status,
        f.payment_date,
        f.description,

        vm.visit_number,
        vm.record_id::text AS record_id,

        mr.record_number,
        mr.record_type::text AS record_type,

        p.patient_name,
        p.patient_number,
        p.clinic_id::text AS clinic_id,

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
        "record_id": row.get("record_id"),
        "record_number": row.get("record_number") or "-",
        "record_type": row.get("record_type") or "-",
        "patient_name": patient_name or "-",
        "patient_number": row.get("patient_number") or "-",
        "user_name": row.get("user_name") or "-",
    }


def fetch_financial_by_transaction_id(transaction_id):
    row = db.session.execute(
        text(
            f"""
            {FINANCIAL_SELECT_QUERY}
            WHERE f.transaction_id::text = :transaction_id
            """
        ),
        {"transaction_id": str(transaction_id)},
    ).mappings().first()

    return row


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

        conditions = [
            """
            (
                p.clinic_id::text = :clinic_id
                OR (
                    p.patient_id IS NULL
                    AND u.clinic_id::text = :clinic_id
                )
            )
            """
        ]

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
        payment_date = parse_payment_date(data.get("payment_date"))
        reference_id = str(data.get("visit_id")).strip()

        resolved_category = resolve_app_category(data.get("trans_type"))
        if resolved_category not in INCOME_TYPES | EXPENSE_TYPES:
            return jsonify({"msg": "Transaction type must be income or expense"}), 400

        trans_type = to_db_category(resolved_category)

        payment_method = normalize_enum_value(
            "payment_type",
            data.get("payment_method"),
        )

        status = normalize_enum_value(
            "payment_status",
            data.get("status"),
        )

        description = (data.get("description") or "").strip()

        try:
            amount = Decimal(str(data.get("amount")))
        except InvalidOperation:
            return jsonify({"msg": "Amount must be a valid number"}), 400

        if amount < 0:
            return jsonify({"msg": "Amount cannot be negative"}), 400

        resolved_reference = resolve_visit_or_record_reference(
            reference_id,
            current_clinic_id,
        )

        if not resolved_reference:
            return jsonify({"msg": "Visit or medical record not found in your clinic"}), 404

        visit_id = resolved_reference.get("visit_id")
        patient_id = resolved_reference.get("patient_id")

        year = payment_date.year
        sequence_number = reserve_next_sequence(year)
        transaction_number = generate_financial_number(year, sequence_number)
        transaction_id = str(uuid.uuid4())

        db.session.execute(
            text(
                """
                INSERT INTO financial (
                    transaction_id,
                    visit_id,
                    user_id,
                    patient_id,
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
                    :transaction_number,
                    CAST(:trans_type AS transaction_category),
                    :amount,
                    CAST(:payment_method AS payment_type),
                    CAST(:status AS payment_status),
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
                "transaction_number": transaction_number,
                "trans_type": trans_type,
                "amount": amount,
                "payment_method": payment_method,
                "status": status,
                "payment_date": payment_date,
                "description": description,
            },
        )

        saved_row = fetch_financial_by_transaction_id(transaction_id)

        write_audit_log(
            user_id=current_user_id,
            action="ADD_INVOICE",
            old_values={},
            new_values={
                "module": "Financial",
                "transaction_id": transaction_id,
                "transaction_number": transaction_number,
                "visit_id": visit_id,
                "patient_id": str(patient_id),
                "trans_type": trans_type,
                "amount": str(amount),
                "payment_method": payment_method,
                "status": status,
                "payment_date": str(payment_date),
                "description": description,
            },
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Financial transaction added successfully",
                    "data": serialize_financial_row(saved_row),
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