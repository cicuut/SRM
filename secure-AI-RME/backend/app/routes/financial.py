from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.models import db
from app.utils import decrypt_data, generate_financial_number
from datetime import datetime
from decimal import Decimal, InvalidOperation
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
import uuid


financial_bp = Blueprint('financial', __name__)


def parse_payment_date(value):
    if not value:
        return None

    return datetime.strptime(value, "%Y-%m-%d").date()


def format_date(value):
    if not value:
        return None

    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")

    return str(value)


def get_enum_labels(type_name):
    rows = db.session.execute(
        text("""
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = :type_name
            ORDER BY e.enumsortorder
        """),
        {"type_name": type_name}
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
        text("""
            SELECT COALESCE(
                MAX(CAST(split_part(transaction_number, '-', 3) AS INTEGER)),
                0
            ) AS max_number
            FROM financial
            WHERE transaction_number ~ :pattern
        """),
        {
            "pattern": f"^INV-{int(year)}-[0-9]+$"
        }
    ).scalar()

    return int(result or 0)


def get_next_sequence_preview(year):
    existing_max = get_max_existing_sequence(year)

    sequence_row = db.session.execute(
        text("""
            SELECT last_number
            FROM financial_sequence
            WHERE year = :year
        """),
        {
            "year": int(year)
        }
    ).first()

    sequence_number = int(sequence_row[0]) if sequence_row else 0
    next_number = max(existing_max, sequence_number) + 1

    return next_number


def reserve_next_sequence(year):
    existing_max = get_max_existing_sequence(year)

    result = db.session.execute(
        text("""
            INSERT INTO financial_sequence (year, last_number)
            VALUES (:year, :next_number)
            ON CONFLICT (year)
            DO UPDATE SET last_number = GREATEST(
                financial_sequence.last_number,
                :existing_max
            ) + 1
            RETURNING last_number
        """),
        {
            "year": int(year),
            "existing_max": int(existing_max),
            "next_number": int(existing_max) + 1
        }
    )

    return int(result.scalar_one())


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

        mr.record_number,
        mr.record_type,

        p.patient_name,
        u.fullname AS user_name
    FROM financial f
    LEFT JOIN medical_record mr
        ON mr.record_id::text = f.visit_id::text
    LEFT JOIN patient p
        ON p.patient_id::text = f.patient_id::text
    LEFT JOIN users u
        ON u.user_id::text = f.user_id::text
"""


def serialize_financial_row(row):
    encrypted_patient_name = row.get("patient_name")
    patient_name = decrypt_data(encrypted_patient_name) if encrypted_patient_name else "-"

    payment_date = format_date(row.get("payment_date"))

    return {
        "transaction_id": row.get("transaction_id"),
        "visit_id": row.get("visit_id"),
        "user_id": row.get("user_id"),
        "patient_id": row.get("patient_id"),

        "transaction_number": row.get("transaction_number"),

        # Sesuai request kamu: date akan tampil di kolom Trans ID.
        "trans_id": payment_date,
        "payment_date": payment_date,

        "trans_type": row.get("trans_type"),
        "amount": float(row.get("amount") or 0),
        "payment_method": row.get("payment_method"),
        "status": row.get("status"),
        "description": row.get("description") or "",

        # Untuk kolom Visit_ID di frontend.
        # Karena sumbernya dari medical record, kita tampilkan record_number.
        "visit_display": row.get("record_number") or row.get("visit_id") or "-",
        "record_number": row.get("record_number") or "-",
        "record_type": row.get("record_type") or "-",

        "patient_name": patient_name or "-",
        "user_name": row.get("user_name") or "-"
    }


def fetch_financial_by_transaction_id(transaction_id):
    row = db.session.execute(
        text(f"""
            {FINANCIAL_SELECT_QUERY}
            WHERE f.transaction_id::text = :transaction_id
        """),
        {
            "transaction_id": str(transaction_id)
        }
    ).mappings().first()

    return row


@financial_bp.route('/transaction-number', methods=['GET'])
@jwt_required()
def get_transaction_number():
    try:
        date_param = request.args.get('date')
        year_param = request.args.get('year')

        if date_param:
            payment_date = parse_payment_date(date_param)
            year = payment_date.year
        elif year_param:
            year = int(year_param)
        else:
            year = datetime.utcnow().year

        next_number = get_next_sequence_preview(year)
        transaction_number = generate_financial_number(year, next_number)

        return jsonify({
            "transaction_number": transaction_number,
            "year": year,
            "next_number": next_number
        }), 200

    except ValueError:
        return jsonify({
            "msg": "Invalid date format. Use YYYY-MM-DD"
        }), 400

    except Exception as e:
        return jsonify({
            "msg": "Failed to generate transaction number",
            "error": str(e)
        }), 500


@financial_bp.route('/get-all', methods=['GET'])
@jwt_required()
def get_all_financial_transactions():
    try:
        claims = get_jwt()
        current_clinic_id = claims.get("clinic_id")

        date_filter = request.args.get("date")
        search_query = request.args.get("search", "").strip()

        conditions = []
        params = {}

        if current_clinic_id:
            conditions.append("p.clinic_id::text = :clinic_id")
            params["clinic_id"] = str(current_clinic_id)

        if date_filter:
            conditions.append("f.payment_date = :payment_date")
            params["payment_date"] = parse_payment_date(date_filter)

        if search_query:
            conditions.append("""
                (
                    LOWER(f.transaction_number) LIKE :search
                    OR LOWER(COALESCE(mr.record_number, '')) LIKE :search
                    OR LOWER(COALESCE(mr.record_type, '')) LIKE :search
                    OR LOWER(CAST(f.trans_type AS text)) LIKE :search
                    OR LOWER(CAST(f.payment_method AS text)) LIKE :search
                    OR LOWER(CAST(f.status AS text)) LIKE :search
                    OR LOWER(CAST(f.amount AS text)) LIKE :search
                    OR LOWER(COALESCE(u.fullname, '')) LIKE :search
                )
            """)
            params["search"] = f"%{search_query.lower()}%"

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        rows = db.session.execute(
            text(f"""
                {FINANCIAL_SELECT_QUERY}
                {where_clause}
                ORDER BY f.payment_date DESC, f.transaction_number DESC
            """),
            params
        ).mappings().all()

        return jsonify([
            serialize_financial_row(row)
            for row in rows
        ]), 200

    except ValueError:
        return jsonify({
            "msg": "Invalid date format. Use YYYY-MM-DD"
        }), 400

    except Exception as e:
        return jsonify({
            "msg": "Failed to get financial data",
            "error": str(e)
        }), 500


@financial_bp.route('/add', methods=['POST'])
@jwt_required()
def add_financial_transaction():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_user_id = get_jwt_identity()

    data = request.get_json() or {}

    required_fields = [
        "payment_date",
        "visit_id",
        "trans_type",
        "amount",
        "payment_method",
        "status"
    ]

    missing_fields = [
        field for field in required_fields
        if data.get(field) is None or data.get(field) == ""
    ]

    if missing_fields:
        return jsonify({
            "msg": "All required data must be filled",
            "missing_fields": missing_fields
        }), 400

    try:
        payment_date = parse_payment_date(data.get("payment_date"))
        visit_id = str(data.get("visit_id")).strip()

        trans_type = normalize_enum_value(
            "transaction_type",
            data.get("trans_type")
        )

        payment_method = normalize_enum_value(
            "payment_type",
            data.get("payment_method")
        )

        status = normalize_enum_value(
            "payment_status",
            data.get("status")
        )

        description = (data.get("description") or "").strip()

        try:
            amount = Decimal(str(data.get("amount")))
        except InvalidOperation:
            return jsonify({
                "msg": "Amount must be a valid number"
            }), 400

        if amount < 0:
            return jsonify({
                "msg": "Amount cannot be negative"
            }), 400

        record_row = db.session.execute(
            text("""
                SELECT
                    mr.record_id::text AS record_id,
                    mr.record_number,
                    mr.patient_id::text AS patient_id,
                    p.clinic_id::text AS clinic_id,
                    p.patient_name
                FROM medical_record mr
                JOIN patient p
                    ON p.patient_id::text = mr.patient_id::text
                WHERE mr.record_id::text = :visit_id
            """),
            {
                "visit_id": visit_id
            }
        ).mappings().first()

        if not record_row:
            return jsonify({
                "msg": "Medical record not found"
            }), 404

        patient_id = record_row.get("patient_id")

        if (
            current_clinic_id
            and record_row.get("clinic_id")
            and str(record_row.get("clinic_id")) != str(current_clinic_id)
        ):
            return jsonify({
                "msg": "You are not allowed to create financial data for this record"
            }), 403

        year = payment_date.year
        sequence_number = reserve_next_sequence(year)
        transaction_number = generate_financial_number(year, sequence_number)
        transaction_id = str(uuid.uuid4())

        db.session.execute(
            text("""
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
                    CAST(:trans_type AS transaction_type),
                    :amount,
                    CAST(:payment_method AS payment_type),
                    CAST(:status AS payment_status),
                    :payment_date,
                    :description
                )
            """),
            {
                "transaction_id": transaction_id,
                "visit_id": visit_id,
                "user_id": str(current_user_id),
                "patient_id": str(patient_id),
                "transaction_number": transaction_number,
                "trans_type": trans_type,
                "amount": amount,
                "payment_method": payment_method,
                "status": status,
                "payment_date": payment_date,
                "description": description
            }
        )

        saved_row = fetch_financial_by_transaction_id(transaction_id)

        db.session.commit()

        return jsonify({
            "msg": "Financial transaction added successfully",
            "data": serialize_financial_row(saved_row)
        }), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({
            "msg": str(e)
        }), 400

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({
            "msg": "Transaction number already exists. Please try again.",
            "error": str(e)
        }), 409

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "msg": "Failed to add financial transaction",
            "error": str(e)
        }), 500