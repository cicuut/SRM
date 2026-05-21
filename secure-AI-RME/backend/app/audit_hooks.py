from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from flask import has_request_context
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import event, inspect, text

from app.models import db, Audit


JAKARTA_TZ = timezone(timedelta(hours=7))

AUDIT_SKIP_MODELS = {
    "Audit",
}

AUDIT_SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
}

AUDIT_LARGE_FIELDS = {
    "profile_photo",
}

MODEL_MODULE_MAP = {
    "User": "User Management",
    "Clinic": "Clinic",
    "Patient": "Patient",
    "MedicalRecord": "Medical Record",
    "PregnancyRecord": "Rekam Medis Kehamilan",
    "ObstetricHistory": "Riwayat Obstetri",
    "FamilyPlanningRecord": "Rekam Medis KB",
    "GeneralRecord": "Rekam Medis Umum",
    "DeliveryRecord": "Rekam Medis Persalinan",
    "ImmunizationRecord": "Rekam Medis Imunisasi",
    "VisitMaster": "Laporan Harian",
    "VisitPregnancy": "Laporan Kunjungan Kehamilan",
    "VisitFamilyPlanning": "Laporan Kunjungan KB",
    "VisitImunization": "Laporan Kunjungan Imunisasi",
    "VisitGeneral": "Laporan Kunjungan Umum",
    "Financial": "Financial",
}

MODEL_PREFIX_MAP = {
    "User": "USR",
    "Clinic": "CLN",
    "Patient": "PAT",
    "MedicalRecord": "RM",
    "PregnancyRecord": "RMH",
    "ObstetricHistory": "OBS",
    "FamilyPlanningRecord": "KB",
    "GeneralRecord": "RMG",
    "DeliveryRecord": "RMP",
    "ImmunizationRecord": "RMI",
    "VisitMaster": "VIS",
    "VisitPregnancy": "VIS",
    "VisitFamilyPlanning": "VIS",
    "VisitImunization": "VIS",
    "VisitGeneral": "VIS",
    "Financial": "INV",
}

VISIT_RELATED_MODELS = {
    "VisitMaster",
    "VisitPregnancy",
    "VisitFamilyPlanning",
    "VisitImunization",
    "VisitGeneral",
}

VISIT_DETAIL_MODELS = {
    "VisitPregnancy",
    "VisitFamilyPlanning",
    "VisitImunization",
    "VisitGeneral",
}

RECORD_CODE_FIELDS = [
    "transaction_number",
    "visit_number",
    "record_number",
    "patient_number",
    "audit_number",
]

_AUDIT_HOOKS_REGISTERED = False


def now_jakarta():
    return datetime.now(JAKARTA_TZ).replace(tzinfo=None)


def safe_to_string(value):
    if value is None:
        return None

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, bytes):
        return "[bytes]"

    return value


def clean_value(field_name, value):
    field_name = str(field_name or "").lower()

    if field_name in AUDIT_SENSITIVE_FIELDS:
        return "[hidden]"

    if field_name in AUDIT_LARGE_FIELDS:
        return "[set]" if value else None

    value = safe_to_string(value)

    if isinstance(value, str) and len(value) > 500:
        return value[:500] + "..."

    return value


def get_current_user_id():
    if not has_request_context():
        return None

    try:
        identity = get_jwt_identity()
        return str(identity) if identity else None
    except Exception:
        return None


def get_primary_key_value(obj):
    try:
        mapper = inspect(obj.__class__)
        primary_keys = mapper.primary_key

        if not primary_keys:
            return None

        key_name = primary_keys[0].key
        value = getattr(obj, key_name, None)

        return str(value) if value is not None else None
    except Exception:
        return None


def get_module_name(obj):
    return MODEL_MODULE_MAP.get(obj.__class__.__name__, obj.__class__.__name__)


def get_model_prefix(obj):
    return MODEL_PREFIX_MAP.get(obj.__class__.__name__, "REC")


def get_object_value(obj, field_name):
    if not hasattr(obj, field_name):
        return None

    try:
        value = getattr(obj, field_name)
    except Exception:
        return None

    return value


def get_existing_direct_record_code(obj):
    for field_name in RECORD_CODE_FIELDS:
        value = get_object_value(obj, field_name)

        if value:
            return str(value)

    return None


def get_visit_id_from_obj(obj):
    class_name = obj.__class__.__name__

    if class_name == "VisitMaster":
        visit_id = get_object_value(obj, "visit_id")
        return str(visit_id) if visit_id else None

    possible_fields = [
        "visit_id",
        "visit_master_id",
    ]

    for field_name in possible_fields:
        visit_id = get_object_value(obj, field_name)

        if visit_id:
            return str(visit_id)

    try:
        mapper = inspect(obj.__class__)

        for column in mapper.columns:
            if column.key == "visit_id":
                visit_id = getattr(obj, column.key, None)

                if visit_id:
                    return str(visit_id)
    except Exception:
        return None

    return None


def get_visit_data_from_relationship(obj):
    possible_relationships = [
        "visit_master",
        "visit",
        "visitMaster",
        "master_visit",
    ]

    for relationship_name in possible_relationships:
        related_obj = get_object_value(obj, relationship_name)

        if not related_obj:
            continue

        visit_number = get_object_value(related_obj, "visit_number")
        visit_id = get_object_value(related_obj, "visit_id")
        visit_date = get_object_value(related_obj, "visit_date")
        visit_time = get_object_value(related_obj, "visit_time")
        record_id = get_object_value(related_obj, "record_id")

        if visit_number or visit_id:
            return {
                "visit_id": str(visit_id) if visit_id else None,
                "visit_number": str(visit_number) if visit_number else None,
                "visit_date": safe_to_string(visit_date),
                "visit_time": safe_to_string(visit_time),
                "record_id": str(record_id) if record_id else None,
                "record_number": None,
                "record_type": None,
            }

    return None


def find_visit_master_in_session(session, visit_id):
    if not session or not visit_id:
        return None

    for obj in list(session.new) + list(session.dirty):
        if obj.__class__.__name__ != "VisitMaster":
            continue

        obj_visit_id = get_object_value(obj, "visit_id")

        if obj_visit_id and str(obj_visit_id) == str(visit_id):
            visit_number = get_object_value(obj, "visit_number")
            visit_date = get_object_value(obj, "visit_date")
            visit_time = get_object_value(obj, "visit_time")
            record_id = get_object_value(obj, "record_id")

            return {
                "visit_id": str(obj_visit_id),
                "visit_number": str(visit_number) if visit_number else None,
                "visit_date": safe_to_string(visit_date),
                "visit_time": safe_to_string(visit_time),
                "record_id": str(record_id) if record_id else None,
                "record_number": None,
                "record_type": None,
            }

    return None


def fetch_visit_master_data(session, visit_id):
    if not session or not visit_id:
        return None

    try:
        with session.no_autoflush:
            row = session.execute(
                text(
                    """
                    SELECT
                        vm.visit_id::text AS visit_id,
                        vm.visit_number,
                        vm.visit_date,
                        vm.visit_time,
                        vm.record_id::text AS record_id,
                        mr.record_number,
                        mr.record_type::text AS record_type
                    FROM visit_master vm
                    LEFT JOIN medical_record mr
                        ON mr.record_id::text = vm.record_id::text
                    WHERE vm.visit_id::text = :visit_id
                    LIMIT 1
                    """
                ),
                {
                    "visit_id": str(visit_id),
                },
            ).mappings().first()

        if not row:
            return None

        return dict(row)
    except Exception:
        return None


def get_visit_master_data(obj, session=None):
    class_name = obj.__class__.__name__

    if class_name not in VISIT_RELATED_MODELS:
        return None

    if class_name == "VisitMaster":
        visit_id = get_object_value(obj, "visit_id")
        visit_number = get_object_value(obj, "visit_number")
        visit_date = get_object_value(obj, "visit_date")
        visit_time = get_object_value(obj, "visit_time")
        record_id = get_object_value(obj, "record_id")

        visit_data = {
            "visit_id": str(visit_id) if visit_id else None,
            "visit_number": str(visit_number) if visit_number else None,
            "visit_date": safe_to_string(visit_date),
            "visit_time": safe_to_string(visit_time),
            "record_id": str(record_id) if record_id else None,
            "record_number": None,
            "record_type": None,
        }

        if visit_data.get("record_id") and session:
            db_visit_data = fetch_visit_master_data(session, visit_data["visit_id"])

            if db_visit_data:
                visit_data["record_number"] = db_visit_data.get("record_number")
                visit_data["record_type"] = db_visit_data.get("record_type")

        return visit_data

    relationship_data = get_visit_data_from_relationship(obj)

    if relationship_data and relationship_data.get("visit_number"):
        return relationship_data

    visit_id = get_visit_id_from_obj(obj)

    session_data = find_visit_master_in_session(session, visit_id)

    if session_data and session_data.get("visit_number"):
        return session_data

    database_data = fetch_visit_master_data(session, visit_id)

    if database_data:
        return database_data

    return None


def get_existing_record_code(obj, session=None):
    direct_record_code = get_existing_direct_record_code(obj)

    if direct_record_code:
        return direct_record_code

    visit_data = get_visit_master_data(obj, session)

    if visit_data and visit_data.get("visit_number"):
        return str(visit_data.get("visit_number"))

    return None


def make_action(prefix, obj):
    module = get_module_name(obj)

    normalized_module = (
        module.upper()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
    )

    return f"{prefix}_{normalized_module}"


def reserve_next_audit_number(session):
    current_year = now_jakarta().year

    next_number = session.execute(
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

    return current_year, int(next_number)


def generate_audit_number(session):
    current_year, next_number = reserve_next_audit_number(session)

    return f"AUD-{current_year}-{next_number:04d}"


def generate_record_code_from_audit_number(audit_number, prefix="REC"):
    parts = str(audit_number).split("-")

    if len(parts) >= 3:
        return f"{prefix}-{parts[1]}-{parts[2]}"

    return str(audit_number).replace("AUD", prefix, 1)


def enrich_with_visit_master_data(values, obj, session=None):
    if not isinstance(values, dict):
        return values

    visit_data = get_visit_master_data(obj, session)

    if not visit_data:
        return values

    visit_number = visit_data.get("visit_number")

    if visit_number:
        values["visit_number"] = visit_number
        values["record_code"] = visit_number

    if visit_data.get("visit_id"):
        values["visit_id"] = visit_data.get("visit_id")

    if visit_data.get("visit_date"):
        values["visit_date"] = safe_to_string(visit_data.get("visit_date"))

    if visit_data.get("visit_time"):
        values["visit_time"] = safe_to_string(visit_data.get("visit_time"))

    if visit_data.get("record_id"):
        values["medical_record_id"] = visit_data.get("record_id")

    if visit_data.get("record_number"):
        values["record_number"] = visit_data.get("record_number")

    if visit_data.get("record_type"):
        values["record_type"] = visit_data.get("record_type")

    return values


def serialize_object(obj, session=None):
    result = {
        "module": get_module_name(obj),
        "record_id": get_primary_key_value(obj),
        "record_code": get_existing_record_code(obj, session),
    }

    try:
        mapper = inspect(obj.__class__)
    except Exception:
        return enrich_with_visit_master_data(result, obj, session)

    for column in mapper.columns:
        field_name = column.key

        try:
            value = getattr(obj, field_name)
        except Exception:
            value = None

        result[field_name] = clean_value(field_name, value)

    result = enrich_with_visit_master_data(result, obj, session)

    return result


def serialize_updated_values(obj, session=None):
    old_values = {
        "module": get_module_name(obj),
        "record_id": get_primary_key_value(obj),
        "record_code": get_existing_record_code(obj, session),
    }

    new_values = {
        "module": get_module_name(obj),
        "record_id": get_primary_key_value(obj),
        "record_code": get_existing_record_code(obj, session),
    }

    try:
        mapper = inspect(obj.__class__)
        state = inspect(obj)
    except Exception:
        return (
            enrich_with_visit_master_data(old_values, obj, session),
            enrich_with_visit_master_data(new_values, obj, session),
        )

    for column in mapper.columns:
        field_name = column.key

        if field_name.lower() in AUDIT_SENSITIVE_FIELDS:
            continue

        history = state.attrs[field_name].history

        if not history.has_changes():
            continue

        old_raw = history.deleted[0] if history.deleted else None
        new_raw = history.added[0] if history.added else getattr(obj, field_name, None)

        old_values[field_name] = clean_value(field_name, old_raw)
        new_values[field_name] = clean_value(field_name, new_raw)

    old_values = enrich_with_visit_master_data(old_values, obj, session)
    new_values = enrich_with_visit_master_data(new_values, obj, session)

    return old_values, new_values


def has_real_changes(old_values, new_values):
    ignored_keys = {
        "module",
        "record_id",
        "record_code",
        "visit_number",
        "visit_date",
        "visit_time",
        "medical_record_id",
        "record_number",
        "record_type",
    }

    old_keys = set(old_values.keys()) - ignored_keys
    new_keys = set(new_values.keys()) - ignored_keys

    return bool(old_keys or new_keys)


def should_skip_object(obj):
    return obj.__class__.__name__ in AUDIT_SKIP_MODELS


def should_skip_auto_audit(session):
    if session.info.get("skip_auto_audit"):
        return True

    if session.info.get("manual_audit_written"):
        return True

    for obj in session.new:
        if obj.__class__.__name__ == "Audit":
            return True

    return False


def should_generate_fallback_record_code(obj):
    if obj is None:
        return True

    if obj.__class__.__name__ in VISIT_RELATED_MODELS:
        return False

    return True


def ensure_record_code(values, record_code):
    if not isinstance(values, dict):
        return values

    if not record_code:
        return values

    if not values.get("record_code"):
        values["record_code"] = record_code

    return values


def add_audit_log(session, user_id, action, old_values, new_values, obj=None):
    audit_number = generate_audit_number(session)

    prefix = get_model_prefix(obj) if obj is not None else "REC"

    existing_record_code = None

    if isinstance(new_values, dict):
        existing_record_code = new_values.get("record_code") or new_values.get("visit_number")

    if not existing_record_code and isinstance(old_values, dict):
        existing_record_code = old_values.get("record_code") or old_values.get("visit_number")

    if existing_record_code:
        record_code = existing_record_code
    elif should_generate_fallback_record_code(obj):
        record_code = generate_record_code_from_audit_number(audit_number, prefix)
    else:
        record_code = None

    old_values = ensure_record_code(old_values, record_code)
    new_values = ensure_record_code(new_values, record_code)

    audit_log = Audit(
        user_id=user_id,
        audit_number=audit_number,
        times=now_jakarta(),
        action=action,
        old_values=old_values,
        new_values=new_values,
    )

    session.add(audit_log)


def before_flush(session, flush_context, instances):
    if should_skip_auto_audit(session):
        return

    user_id = get_current_user_id()

    if not user_id:
        return

    audit_items = []

    for obj in list(session.new):
        if should_skip_object(obj):
            continue

        audit_items.append(
            {
                "obj": obj,
                "action": make_action("CREATE", obj),
                "old_values": {},
                "new_values": serialize_object(obj, session),
            }
        )

    for obj in list(session.dirty):
        if should_skip_object(obj):
            continue

        if not session.is_modified(obj, include_collections=False):
            continue

        old_values, new_values = serialize_updated_values(obj, session)

        if not has_real_changes(old_values, new_values):
            continue

        audit_items.append(
            {
                "obj": obj,
                "action": make_action("UPDATE", obj),
                "old_values": old_values,
                "new_values": new_values,
            }
        )

    for obj in list(session.deleted):
        if should_skip_object(obj):
            continue

        audit_items.append(
            {
                "obj": obj,
                "action": make_action("DELETE", obj),
                "old_values": serialize_object(obj, session),
                "new_values": {},
            }
        )

    if not audit_items:
        return

    session.info["skip_auto_audit"] = True

    try:
        for item in audit_items:
            add_audit_log(
                session=session,
                user_id=user_id,
                action=item["action"],
                old_values=item["old_values"],
                new_values=item["new_values"],
                obj=item["obj"],
            )
    finally:
        session.info.pop("skip_auto_audit", None)


def clear_audit_session_flags(session):
    session.info.pop("skip_auto_audit", None)
    session.info.pop("manual_audit_written", None)


def register_audit_hooks():
    global _AUDIT_HOOKS_REGISTERED

    if _AUDIT_HOOKS_REGISTERED:
        return

    event.listen(db.session, "before_flush", before_flush)
    event.listen(db.session, "after_commit", clear_audit_session_flags)
    event.listen(db.session, "after_rollback", clear_audit_session_flags)

    _AUDIT_HOOKS_REGISTERED = True