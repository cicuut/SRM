from datetime import date, datetime, timedelta, timezone
import os
import base64
import json
import uuid

from Crypto.Cipher import AES
from dotenv import load_dotenv
from sqlalchemy import text

from . import db


JAKARTA_TZ = timezone(timedelta(hours=7))


def get_jakarta_now():
    return datetime.now(JAKARTA_TZ).replace(tzinfo=None)

from . import db
from sqlalchemy import text

def get_next_record_sequence_and_increment(record_type):
    from app.models import MedicalRecordSequence
    
    current_year = get_jakarta_now().year
    
    seq = MedicalRecordSequence.query.filter_by(
        year=current_year, 
        record_type=record_type
    ).with_for_update().first()

    if not seq:
        seq = MedicalRecordSequence(year=current_year, record_type=record_type, last_number=1)
        db.session.add(seq)
        next_number = 1
    else:
        seq.last_number += 1
        next_number = seq.last_number
        
    db.session.flush()
    return next_number

def generate_record_number(record_type, next_sequence):
    mapping = {
        "Kehamilan": "RMH",
        "Persalinan": "RMP",
        "Imunisasi": "RMI",
        "Umum": "RMU",
        "Keluarga Berencana": "RMK",
    }

    prefix = mapping.get(record_type, "RMG")
    year = get_jakarta_now().year
    sequence = f"{next_sequence:03d}" 

    return f"{prefix}-{year}-{sequence}"


def get_next_visit_sequence_and_increment():
    from app.models import VisitSequence
    current_year = get_jakarta_now().year
    prefix = "VIS"
    
    seq = VisitSequence.query.filter_by(
        year=current_year, 
        prefix=prefix
    ).with_for_update().first()

    if not seq:
        seq = VisitSequence(year=current_year, prefix=prefix, last_number=1)
        db.session.add(seq)
        next_number = 1
    else:
        seq.last_number += 1
        next_number = seq.last_number
        
    db.session.flush()
    return next_number


def generate_visit_number(next_sequence):
    prefix = "VIS"
    year = get_jakarta_now().year
    
    sequence = f"{next_sequence:03d}"

    return f"{prefix}-{year}-{sequence}"


def generate_financial_number(year, sequence_number):
    prefix = "INV"
    sequence = f"{int(sequence_number):04d}"
    current_year = get_jakarta_now().year

    year = datetime.now().year

    return f"{prefix}-{int(current_year)}-{sequence}"


load_dotenv()

raw_secret_key = os.getenv("ENCRYPTION_KEY")

if not raw_secret_key:
    raise RuntimeError("ENCRYPTION_KEY is not set in .env")

secret_key = raw_secret_key.encode()


def encrypt_data(plain_text):
    if not plain_text:
        return None

    cipher = AES.new(secret_key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(str(plain_text).encode())

    combined = cipher.nonce + tag + ciphertext

    return base64.b64encode(combined).decode("utf-8")


def decrypt_data(encrypted_text):
    if not encrypted_text:
        return None

    try:
        combined = base64.b64decode(encrypted_text)

        nonce = combined[:16]
        tag = combined[16:32]
        ciphertext = combined[32:]

        cipher = AES.new(secret_key, AES.MODE_GCM, nonce=nonce)
        plain_text = cipher.decrypt_and_verify(ciphertext, tag)

        return plain_text.decode("utf-8")

    except (ValueError, KeyError, TypeError) as e:
        print(f"Decryption failed (likely old data or wrong key): {e}")
        return encrypted_text


def clean_float(value):
    if value is None or str(value).strip() == "":
        return None

    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def format_date(date_obj):
    if not date_obj:
        return None

    if isinstance(date_obj, datetime):
        return date_obj.strftime("%d %B %Y, %H:%M")

    if isinstance(date_obj, date):
        return date_obj.strftime("%d %B %Y")

    return None


def parse_date(date_str):
    if not date_str:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except (ValueError, TypeError):
            continue

    return None


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


def get_column_name(vaccine, dosage):
    v_name = str(vaccine or "").lower()
    d_num = "".join(filter(str.isdigit, str(dosage or "")))

    return f"{v_name}_{d_num}"


def generate_next_audit_number():
    current_year = get_jakarta_now().year

    next_number = db.session.execute(
        text(
            """
            INSERT INTO public.audit_sequence (year, last_number)
            VALUES (:year, 1)
            ON CONFLICT (year)
            DO UPDATE SET
                last_number = public.audit_sequence.last_number + 1
            RETURNING last_number
            """
        ),
        {
            "year": current_year,
        },
    ).scalar_one()

    return f"AUD-{current_year}-{int(next_number):04d}"


def make_audit_number():
    return generate_next_audit_number()


def clean_audit_json(value):
    if value is None:
        return {}

    if isinstance(value, dict):
        return value

    try:
        return json.loads(json.dumps(value, default=str))
    except Exception:
        return {"value": str(value)}


def write_audit_log(user_id, action, old_values=None, new_values=None):
    """
    Jangan commit di helper ini.
    Commit tetap di route utama.

    Jadi kalau proses utama gagal dan rollback,
    audit juga ikut rollback.
    """

    if not user_id:
        return None

    db.session.info["manual_audit_written"] = True

    audit_log_id = str(uuid.uuid4())
    audit_number = generate_next_audit_number()

    db.session.execute(
        text(
            """
            INSERT INTO audit (
                log_id,
                user_id,
                audit_number,
                times,
                action,
                old_values,
                new_values
            )
            VALUES (
                CAST(:log_id AS uuid),
                CAST(:user_id AS uuid),
                :audit_number,
                :times,
                :action,
                CAST(:old_values AS jsonb),
                CAST(:new_values AS jsonb)
            )
            """
        ),
        {
            "log_id": audit_log_id,
            "user_id": str(user_id),
            "audit_number": audit_number,
            "times": get_jakarta_now(),
            "action": action,
            "old_values": json.dumps(clean_audit_json(old_values), default=str),
            "new_values": json.dumps(clean_audit_json(new_values), default=str),
        },
    )

    return {
        "log_id": audit_log_id,
        "audit_number": audit_number,
    }