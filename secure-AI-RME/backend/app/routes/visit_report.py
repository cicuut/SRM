from flask import Blueprint, request, jsonify
from app.models import (
    PregnancyRecord,
    User,
    db,
    Patient,
    MedicalRecord,
    DeliveryRecord,
    VisitMaster,
    VisitPregnancy,
    VisitFamilyPlanning,
    ImmunizationRecord,
    VisitImunization,
    GeneralRecord,
    VisitGeneral,
    FamilyPlanningRecord,
    Financial,
)
from app.utils import (
    generate_visit_number,
    get_next_visit_sequence_and_increment,
    decrypt_data,
    get_column_name,
    clean_float,
    format_date,
    generate_financial_number,
    reserve_next_sequence,
)
from datetime import datetime
from flask_jwt_extended import get_jwt_identity, jwt_required
import pytz
from sqlalchemy import func


visit_report_bp = Blueprint("visit_report", __name__)

VISIT_ALLOWED_ROLES = ["admin", "midwife", "asisten"]
JAKARTA_TZ = pytz.timezone("Asia/Jakarta")


# -----------------------------------------------------------------------------
# Access helpers
# -----------------------------------------------------------------------------
def role_to_text(value):
    if value is None:
        return ""

    if hasattr(value, "value"):
        return str(value.value)

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


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_visit_access():
    current_user = get_current_user()

    if not current_user:
        return None, "", (jsonify({"msg": "User tidak ditemukan."}), 404)

    if not current_user.is_active:
        return None, "", (jsonify({"msg": "Akun Anda sedang tidak aktif."}), 403)

    current_role = normalize_role(role_to_text(current_user.user_role))

    if current_role not in VISIT_ALLOWED_ROLES:
        return None, current_role, (
            jsonify({"msg": "Akses ditolak. Role ini tidak dapat mengakses laporan kunjungan."}),
            403,
        )
    if not current_user.clinic_id:
        response = {
                "msg": "Akun belum terhubung dengan klinik.",
                "requires_clinic_setup": current_role == "midwife",
                "redirect_path": "/register-clinic" if current_role == "midwife" else "/dashboard",
        }
        return None, current_role, (jsonify(response), 400)

    return current_user, current_role, None


def query_records_for_user(current_user, current_role):
    query = db.session.query(MedicalRecord, Patient).join(
        Patient,
        MedicalRecord.patient_id == Patient.patient_id,
    )

    query = query.filter(Patient.clinic_id == current_user.clinic_id)

    return query


def query_visits_for_user(current_user, current_role):
    query = (
        db.session.query(VisitMaster, MedicalRecord, Patient, User)
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .join(User, VisitMaster.user_id == User.user_id)
    )

    query = query.filter(Patient.clinic_id == current_user.clinic_id)
    return query


def get_record_for_user(record_id, current_user, current_role):
    result = (
        query_records_for_user(current_user, current_role)
        .filter(MedicalRecord.record_id == str(record_id))
        .first()
    )

    if not result:
        return None, None

    return result


def get_visit_for_user(visit_id, current_user, current_role):
    return (
        query_visits_for_user(current_user, current_role)
        .filter(VisitMaster.visit_id == str(visit_id))
        .first()
    )


def safe_decrypt(value):
    if value is None:
        return ""

    try:
        return decrypt_data(value)
    except Exception:
        return str(value)


def safe_time(value):
    if not value:
        return "-"

    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")

    return str(value)


def format_visit_datetime(visit):
    return f"{format_date(visit.visit_date)} {safe_time(visit.visit_time)}"


def get_patient_display_name(patient):
    if not patient:
        return "Pasien"

    return safe_decrypt(patient.patient_name) or "Pasien"


def get_financial_amount(data):
    status = str(data.get("payment_status") or "").strip().lower()

    if status == "unpaid":
        return clean_float(data.get("total")) or 0

    return clean_float(data.get("total")) or 0


def validate_billing_data(data):
    payment_status = str(data.get("payment_status") or "").strip().lower()

    if payment_status not in {"paid", "unpaid"}:
        return (
            jsonify(
                {
                    "msg": (
                        "Status pembayaran wajib dipilih. "
                        "Pilih Terbayar atau Belum Bayar."
                    )
                }
            ),
            400,
        )

    data["payment_status"] = payment_status
    return None


def create_financial_for_visit(
    *,
    visit_id,
    user_id,
    patient_id,
    clinic_id,
    record_number,
    patient_name,
    data,
    payment_date,
    visit_status,
):
    current_year = payment_date.year
    sequence_number = reserve_next_sequence(current_year, clinic_id)
    transaction_number = generate_financial_number(current_year, sequence_number)

    auto_desc = f"Pemasukan dari kunjungan {record_number} - {patient_name}"
    final_description = data.get("payment_description") or auto_desc

    new_financial = Financial(
        visit_id=visit_id,
        user_id=user_id,
        patient_id=patient_id,
        clinic_id=clinic_id,
        transaction_number=transaction_number,
        trans_type="pemasukan",
        amount=get_financial_amount(data),
        payment_method=data.get("payment_method"),
        status=data["payment_status"],
        payment_date=payment_date,
        description=final_description,
        visit_status=visit_status,
    )

    db.session.add(new_financial)
    return new_financial


def serialize_visit_row(visit, medical_record, patient, user):
    decrypted_name = safe_decrypt(patient.patient_name)
    decrypted_nik = safe_decrypt(patient.national_id)

    return {
        "visit_id": str(visit.visit_id),
        "visit_date": format_visit_datetime(visit),
        "visit_number": visit.visit_number,
        "record_number": medical_record.record_number,
        "patient_name": decrypted_name,
        "nik": decrypted_nik,
        "record_type": medical_record.record_type,
        "made_by": user.fullname if user else "-",
        "status": visit.visit_status,
    }


def get_visit_type_from_detail(visit_id):
    if VisitGeneral.query.filter_by(visit_id=visit_id).first():
        return "Umum"

    if VisitPregnancy.query.filter_by(visit_id=visit_id).first():
        return "Kehamilan"

    if VisitImunization.query.filter_by(visit_id=visit_id).first():
        return "Imunisasi"

    if VisitFamilyPlanning.query.filter_by(visit_id=visit_id).first():
        return "Keluarga Berencana"

    return "Umum"


def get_visit_finance(visit_id):
    return Financial.query.filter_by(visit_id=visit_id).first()


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@visit_report_bp.route("/visit-number", methods=["GET"])
@jwt_required()
def get_visit_number():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        clinic_id = current_user.clinic_id
        
        if not clinic_id:
            return jsonify({'msg': 'Akun Anda belum terikat dengan klinik mana pun.'}), 400
        
        count = get_next_visit_sequence_and_increment(clinic_id)
        next_visit_number = generate_visit_number(count)

        return jsonify({"visit_number": next_visit_number}), 200

    except Exception as e:
        return jsonify({"msg": "Gagal membuat nomor kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-information", methods=["GET"])
@jwt_required()
def get_visit_information():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    record_id = request.args.get("uuid")

    try:
        if not record_id:
            return jsonify({"msg": "ID rekam medis wajib diisi."}), 400

        record, patient = get_record_for_user(record_id, current_user, current_role)

        if not record or not patient:
            return jsonify({"msg": "Rekam medis tidak ditemukan atau bukan milik klinik Anda."}), 404

        now_local = datetime.now()

        response_data = {
            "patient_name": get_patient_display_name(patient),
            "record_number": record.record_number,
            "record_type": record.record_type,
            "visit_date": format_date(now_local.date()),
            "visit_time": now_local.strftime("%H:%M"),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/get-all-visit", methods=["GET"])
@jwt_required()
def get_all_records():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        results = (
            query_visits_for_user(current_user, current_role)
            .order_by(VisitMaster.visit_date.desc(), VisitMaster.visit_time.desc())
            .all()
        )

        record_list = [
            serialize_visit_row(visit, medical_record, patient, user)
            for visit, medical_record, patient, user in results
        ]

        return jsonify(record_list), 200

    except Exception as e:
        return jsonify({"msg": "Gagal mengambil data kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-report/<uuid>", methods=["GET"])
@jwt_required()
def get_visit_detail(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(uuid, current_user, current_role)

        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        visit, medical_record, patient, user = result

        response_data = {
            "visit_id": str(visit.visit_id),
            "visit_number": visit.visit_number,
            "visit_type": medical_record.record_type,
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-data/<uuid>", methods=["GET"])
@jwt_required()
def get_patient_data(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(uuid, current_user, current_role)

        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        visit, medical_record, patient, user = result

        return jsonify({
            "visit_id": str(visit.visit_id),
            "visit_date": format_visit_datetime(visit),
            "visit_number": visit.visit_number,
            "rm_number": medical_record.record_number,
            "patient_name": get_patient_display_name(patient),
            "nik": safe_decrypt(patient.national_id),
            "record_type": medical_record.record_type,
            "made_by": user.fullname if user else "-",
            "status": visit.visit_status,
        }), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/add-visit-pregnancy", methods=["POST"])
@jwt_required()
def add_visit_pregnancy():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    data = request.get_json() or {}
    billing_error = validate_billing_data(data)

    if billing_error:
        return billing_error

    record_id = data.get("record_id")
    now_local = datetime.now()
    visit_date = now_local.date()
    try:
        record, patient = get_record_for_user(record_id, current_user, current_role)

        if not record or not patient:
            return jsonify({"msg": "Data rekam medis tidak ditemukan atau bukan milik klinik Anda."}), 404

        pregnancy_record = PregnancyRecord.query.filter_by(record_id=record_id).first()
        if not pregnancy_record:
            return jsonify({"msg": "Data rekam medis kehamilan tidak ditemukan."}), 404
        
        count = get_next_visit_sequence_and_increment(patient.clinic_id)
        generated_visit_number = generate_visit_number(count)

        role_str = str(current_role).strip().lower()
        
        if role_str in ["midwife"]:
            initial_status = "approved"
        else:
            initial_status = "pending"
        
        new_visit = VisitMaster(
            record_id=record_id,
            user_id=current_user.user_id,
            clinic_id=patient.clinic_id,
            visit_number=generated_visit_number,
            visit_date=visit_date,
            visit_time=now_local,
            visit_status=initial_status
        )
        db.session.add(new_visit)
        db.session.flush()

        new_pregnancy_visit = VisitPregnancy(
            visit_id=new_visit.visit_id,
            pr_id=pregnancy_record.pr_id,
            blood_pressure=data.get("blood_pressure"),
            weight_kg=clean_float(data.get("weight")),
            height_cm=clean_float(data.get("height")),
            body_temperature=clean_float(data.get("temperature")),
            respiratory_rate=clean_float(data.get("respiratory_rate")),
            heart_rate=clean_float(data.get("heart_rate")),
            subjective=data.get("subjective"),
            objective=data.get("objective"),
            assessment=data.get("assessment"),
            plan=data.get("plan"),
        )
        db.session.add(new_pregnancy_visit)

        create_financial_for_visit(
            visit_id=new_visit.visit_id,
            user_id=current_user.user_id,
            patient_id=record.patient_id,
            clinic_id=patient.clinic_id,
            record_number=record.record_number,
            patient_name=get_patient_display_name(patient),
            data=data,
            payment_date=now_local,
            visit_status=initial_status,
        )
        record.last_update = now_local
        db.session.commit()

        return jsonify({
            "msg": "Kunjungan berhasil ditambahkan.",
            "rm_number": str(new_visit.record_id),
            "visit_id": str(new_visit.visit_id),
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-pregnancy/<uuid>", methods=["GET"])
@jwt_required()
def get_pregnancy_visit(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(uuid, current_user, current_role)

        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        visit_report, medical_record, patient, user = result

        current_pregnancy_visit = VisitPregnancy.query.filter_by(visit_id=uuid).first()
        if not current_pregnancy_visit:
            return jsonify({"msg": "Data kehamilan tidak ditemukan."}), 404

        current_finance = get_visit_finance(uuid)

        return jsonify({
            "subjective": safe_decrypt(current_pregnancy_visit.subjective) or "-",
            "objective": safe_decrypt(current_pregnancy_visit.objective) or "-",
            "assessment": safe_decrypt(current_pregnancy_visit.assessment) or "-",
            "plan": safe_decrypt(current_pregnancy_visit.plan) or "-",
            "weight": current_pregnancy_visit.weight_kg or "-",
            "height": current_pregnancy_visit.height_cm or "-",
            "body_temperature": current_pregnancy_visit.body_temperature or "-",
            "respiratory_rate": current_pregnancy_visit.respiratory_rate or "-",
            "heart_rate": current_pregnancy_visit.heart_rate or "-",
            "blood_pressure": current_pregnancy_visit.blood_pressure or "-",
            "visit_number": visit_report.visit_number,
            "finance": {
                "invoice_number": current_finance.transaction_number if current_finance else "-",
                "description": safe_decrypt(current_finance.description) if current_finance else "-",
                "total_amount": current_finance.amount if current_finance else 0,
                "status": current_finance.status if current_finance else "unpaid",
                "payment_method": current_finance.payment_method if current_finance else "-",
            },
        }), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/update-visit-pregnancy/<uuid>", methods=["PUT"])
@jwt_required()
def update_pregnancy_visit_report(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        data = request.get_json() or {}
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong."}), 400

        visit_id_str = str(uuid)

        result = get_visit_for_user(uuid, current_user, current_role)
        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        current_pregnancy_visit = VisitPregnancy.query.filter_by(visit_id=uuid).first()
        if not current_pregnancy_visit:
            return jsonify({"msg": "Data kehamilan tidak ditemukan."}), 404

        current_pregnancy_visit.weight_kg = clean_float(data.get("weight"))
        current_pregnancy_visit.height_cm = clean_float(data.get("height"))
        current_pregnancy_visit.body_temperature = clean_float(data.get("body_temperature"))
        current_pregnancy_visit.respiratory_rate = clean_float(data.get("respiratory_rate"))
        current_pregnancy_visit.heart_rate = clean_float(data.get("heart_rate"))
        current_pregnancy_visit.blood_pressure = data.get("blood_pressure", "")
        current_pregnancy_visit.subjective = data.get("subjective", "")
        current_pregnancy_visit.objective = data.get("objective", "")
        current_pregnancy_visit.assessment = data.get("assessment", "")
        current_pregnancy_visit.plan = data.get("plan", "")
        
        visit_base = result[0] if isinstance(result, tuple) else result
        
        if visit_base and hasattr(visit_base, 'record_id') and visit_base.record_id:
            db.session.query(MedicalRecord).filter(
                MedicalRecord.medical_record_id == visit_base.record_id 
            ).update({"last_update": datetime.now()})

 
        role_str = str(current_role).strip().lower()
        if role_str in ["asisten", "assistant", "staff"]:
                visit_master = VisitMaster.query.filter_by(visit_id=visit_id_str).first()            
                if visit_master:
                    visit_master.visit_status = "pending"
            
        db.session.commit()

        return jsonify({"msg": "Catatan medis berhasil diperbarui.", "visit_id": str(uuid)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/add-visit-family-planning", methods=["POST"])
@jwt_required()
def add_visit_familyplanning():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    data = request.get_json() or {}
    billing_error = validate_billing_data(data)

    if billing_error:
        return billing_error

    record_id = data.get("record_id")
    now_local = datetime.now()
    visit_date = now_local.date()
    try:
        record, patient = get_record_for_user(record_id, current_user, current_role)

        if not record or not patient:
            return jsonify({"msg": "Data rekam medis tidak ditemukan atau bukan milik klinik Anda."}), 404

        kb_record = FamilyPlanningRecord.query.filter_by(record_id=record_id).first()
        if not kb_record:
            return jsonify({"msg": "Data rekam medis KB tidak ditemukan."}), 404

        count = get_next_visit_sequence_and_increment(patient.clinic_id)
        generated_visit_number = generate_visit_number(count)

        role_str = str(current_role).strip().lower()
        if role_str in ["midwife"]:
            initial_status = "approved"
        else:
            initial_status = "pending"

        new_visit = VisitMaster(
            record_id=record_id,
            user_id=current_user.user_id,
            clinic_id=patient.clinic_id,
            visit_number=data.get("visit_number"),
            visit_status=initial_status,
            visit_date=visit_date,
            visit_time=now_local,
        )
        db.session.add(new_visit)
        db.session.flush()

        new_familyplanning_visit = VisitFamilyPlanning(
            visit_id=new_visit.visit_id,
            kb_id=kb_record.kb_id,
            weight_kg=clean_float(data.get("weight")),
            blood_pressure=data.get("blood_pressure"),
            kb_method=data.get("contraceptive_method"),
            return_visit_date=data.get("return_visit_date"),
            complaint=data.get("complaint"),
        )
        db.session.add(new_familyplanning_visit)

        create_financial_for_visit(
            visit_id=new_visit.visit_id,
            user_id=current_user.user_id,
            patient_id=record.patient_id,
            clinic_id=patient.clinic_id,
            record_number=record.record_number,
            patient_name=get_patient_display_name(patient),
            data=data,
            payment_date=now_local,
            visit_status=initial_status
        )

        record.last_update = now_local
        db.session.commit()

        return jsonify({
            "msg": "Kunjungan berhasil ditambahkan.",
            "rm_number": str(new_visit.record_id),
            "visit_id": str(new_visit.visit_id),
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-family-planning/<uuid>", methods=["GET"])
@jwt_required()
def get_familyplanning_visit(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(uuid, current_user, current_role)

        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        visit_report, medical_record, patient, user = result

        current_familyplanning_visit = VisitFamilyPlanning.query.filter_by(visit_id=uuid).first()
        if not current_familyplanning_visit:
            return jsonify({"msg": "Data KB tidak ditemukan."}), 404

        current_finance = get_visit_finance(uuid)

        return jsonify({
            "complaint": safe_decrypt(current_familyplanning_visit.complaint),
            "weight_kg": clean_float(current_familyplanning_visit.weight_kg),
            "visit_number": visit_report.visit_number if visit_report else "-",
            "blood_pressure": current_familyplanning_visit.blood_pressure,
            "contraceptive_method": current_familyplanning_visit.kb_method,
            "return_visit_date": format_date(current_familyplanning_visit.return_visit_date) if current_familyplanning_visit.return_visit_date else None,
            "finance": {
                "invoice_number": current_finance.transaction_number if current_finance else "-",
                "total_amount": current_finance.amount if current_finance else 0,
                "payment_method": current_finance.payment_method if current_finance else "-",
                "status": current_finance.status if current_finance else "-",
            },
        }), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/update-visit-family-planning/<uuid>", methods=["PUT"])
@jwt_required()
def update_familyplanning_visit_report(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        data = request.get_json() or {}
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong."}), 400

        visit_id_str = str(uuid)

        result = get_visit_for_user(uuid, current_user, current_role)
        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        current_familyplanning_visit = VisitFamilyPlanning.query.filter_by(visit_id=uuid).first()
        if not current_familyplanning_visit:
            return jsonify({"msg": "Data KB tidak ditemukan."}), 404

        current_familyplanning_visit.weight_kg = clean_float(data.get("weight_kg"))
        current_familyplanning_visit.blood_pressure = data.get("blood_pressure", "")
        current_familyplanning_visit.kb_method = data.get("contraceptive_method", "")
        current_familyplanning_visit.return_visit_date = data.get("return_visit_date", "")
        current_familyplanning_visit.complaint = data.get("complaint", current_familyplanning_visit.complaint)

        visit_base = result[0] if isinstance(result, tuple) else result

        if visit_base and hasattr(visit_base, 'record_id') and visit_base.record_id:
            db.session.query(MedicalRecord).filter(
                MedicalRecord.medical_record_id == visit_base.record_id 
            ).update({"last_update": datetime.now()})

        role_str = str(current_role).strip().lower()
        if role_str in ["asisten", "assistant", "staff"]:
            visit_master = VisitMaster.query.filter_by(visit_id=visit_id_str).first()            
            if visit_master:
                visit_master.visit_status = "pending"

        db.session.commit()

        return jsonify({"msg": "Catatan medis KB berhasil diperbarui.", "visit_id": str(uuid)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/add-visit-immunization", methods=["POST"])
@jwt_required()
def add_visit_immunization():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    data = request.get_json() or {}
    billing_error = validate_billing_data(data)

    if billing_error:
        return billing_error

    record_id = data.get("record_id")
    vaccine_given = data.get("vaccine_given")
    dosage_given = data.get("dosage_given")
    now_local = datetime.now()
    visit_date = now_local.date()

    try:
        record, patient = get_record_for_user(record_id, current_user, current_role)

        if not record or not patient:
            return jsonify({"msg": "Data rekam medis tidak ditemukan atau bukan milik klinik Anda."}), 404

        imm_record = ImmunizationRecord.query.filter_by(record_id=record_id).first()
        if not imm_record:
            imm_record = ImmunizationRecord(record_id=record_id)
            db.session.add(imm_record)
            db.session.flush()

        if vaccine_given and dosage_given:
            col_name = get_column_name(vaccine_given, dosage_given)

            if col_name and hasattr(imm_record, col_name):
                setattr(imm_record, col_name, visit_date)
            else:
                return jsonify({"msg": f"Jenis vaksin '{vaccine_given}' tidak dikenali sistem."}), 400
            
        count = get_next_visit_sequence_and_increment(patient.clinic_id)
        generated_visit_number = generate_visit_number(count)

        role_str = str(current_role).strip().lower()
        if role_str in ["midwife"]:
            initial_status = "approved"
        else:
            initial_status = "pending"

        new_visit = VisitMaster(
            record_id=record_id,
            user_id=current_user.user_id,
            clinic_id=patient.clinic_id,
            visit_number=generated_visit_number,
            visit_date=visit_date,
            visit_time=now_local,
            visit_status=initial_status
        )
        db.session.add(new_visit)
        db.session.flush()

        new_detail = VisitImunization(
            visit_id=new_visit.visit_id,
            ir_id=imm_record.ir_id,
            baby_weight=clean_float(data.get("weight_kg")),
            baby_height=clean_float(data.get("height_cm")),
            body_temp=clean_float(data.get("body_temperature")),
            head_circumference=clean_float(data.get("head_circumference")),
            abdominal_circumference=clean_float(data.get("abdominal_circumference")),
            dosage_given=dosage_given if dosage_given else None,
            vaccine_given=vaccine_given if vaccine_given else None,
        )
        db.session.add(new_detail)

        create_financial_for_visit(
            visit_id=new_visit.visit_id,
            user_id=current_user.user_id,
            patient_id=record.patient_id,
            clinic_id=patient.clinic_id,
            record_number=record.record_number,
            patient_name=get_patient_display_name(patient),
            data=data,
            payment_date=now_local,
            visit_status=initial_status
        )

        record.last_update = now_local
        db.session.commit()

        return jsonify({
            "msg": "Data imunisasi berhasil disimpan.",
            "visit_id": str(new_visit.visit_id),
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menyimpan data imunisasi.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-immunization/<uuid>", methods=["GET"])
@jwt_required()
def get_immunization_visit(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(uuid, current_user, current_role)

        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        current_immunization_visit = VisitImunization.query.filter_by(visit_id=uuid).first()
        if not current_immunization_visit:
            return jsonify({"msg": "Data imunisasi tidak ditemukan."}), 404

        current_finance = get_visit_finance(uuid)

        return jsonify({
            "weight_kg": current_immunization_visit.baby_weight or "-",
            "height_cm": current_immunization_visit.baby_height or "-",
            "body_temperature": current_immunization_visit.body_temp or "-",
            "head_circumference": current_immunization_visit.head_circumference or "-",
            "abdominal_circumference": current_immunization_visit.abdominal_circumference or "-",
            "vaccine_given": current_immunization_visit.vaccine_given or "-",
            "dosage_given": current_immunization_visit.dosage_given or "-",
            "finance": {
                "invoice_number": current_finance.transaction_number if current_finance else "-",
                "total_amount": current_finance.amount if current_finance else 0,
                "payment_method": current_finance.payment_method if current_finance else "-",
                "status": current_finance.status if current_finance else "-",
            },
        }), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/update-visit-immunization/<uuid>", methods=["PUT"])
@jwt_required()
def update_immunization_visit(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        data = request.get_json() or {}
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong."}), 400

        visit_id_str = str(uuid)

        result = get_visit_for_user(uuid, current_user, current_role)
        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        current_immunization_visit = VisitImunization.query.filter_by(visit_id=uuid).first()
        if not current_immunization_visit:
            return jsonify({"msg": "Data imunisasi tidak ditemukan."}), 404

        current_imm_record = ImmunizationRecord.query.get(current_immunization_visit.ir_id)
        if not current_imm_record:
            return jsonify({"msg": "Data rekam imunisasi tidak ditemukan."}), 404

        new_vaccine_given = data.get("vaccine_given", "")
        new_dosage_given = data.get("dosage_given", "")

        if (
            current_immunization_visit.vaccine_given != new_vaccine_given
            or current_immunization_visit.dosage_given != new_dosage_given
        ):
            if current_immunization_visit.vaccine_given and current_immunization_visit.dosage_given:
                old_col_name = get_column_name(
                    current_immunization_visit.vaccine_given,
                    current_immunization_visit.dosage_given,
                )

                if old_col_name and hasattr(current_imm_record, old_col_name):
                    setattr(current_imm_record, old_col_name, None)

        if new_vaccine_given and new_dosage_given:
            col_name = get_column_name(new_vaccine_given, new_dosage_given)

            if col_name and hasattr(current_imm_record, col_name):
                visit, medical_record, patient, user = result
                target_date = visit.visit_date if visit else datetime.now().date()
                setattr(current_imm_record, col_name, target_date)
            else:
                return jsonify({"msg": f"Jenis vaksin '{new_vaccine_given}' atau dosis tidak dikenali sistem."}), 400

        current_immunization_visit.baby_weight = clean_float(data.get("weight_kg"))
        current_immunization_visit.baby_height = clean_float(data.get("height_cm"))
        current_immunization_visit.body_temp = clean_float(data.get("body_temperature"))
        current_immunization_visit.head_circumference = clean_float(data.get("head_circumference"))
        current_immunization_visit.abdominal_circumference = clean_float(data.get("abdominal_circumference"))
        current_immunization_visit.vaccine_given = new_vaccine_given
        current_immunization_visit.dosage_given = new_dosage_given

        visit_base = result[0] if isinstance(result, tuple) else result
        if visit_base and hasattr(visit_base, 'record_id') and visit_base.record_id:
            db.session.query(MedicalRecord).filter(
                MedicalRecord.medical_record_id == visit_base.record_id 
            ).update({"last_update": datetime.now()})

        role_str = str(current_role).strip().lower()
        if role_str in ["asisten", "assistant", "staff"]:
                visit_master = VisitMaster.query.filter_by(visit_id=visit_id_str).first()            
                if visit_master:
                    visit_master.visit_status = "pending"

        db.session.commit()

        return jsonify({"msg": "Catatan medis imunisasi berhasil diperbarui.", "visit_id": str(uuid)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/add-visit-general", methods=["POST"])
@jwt_required()
def add_visit_general():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    data = request.get_json() or {}
    billing_error = validate_billing_data(data)

    if billing_error:
        return billing_error

    record_id = data.get("record_id")
    now_local = datetime.now()
    visit_date = now_local.date()
    try:
        record, patient = get_record_for_user(record_id, current_user, current_role)

        if not record or not patient:
            return jsonify({"msg": "Data rekam medis tidak ditemukan atau bukan milik klinik Anda."}), 404

        gen_record = GeneralRecord.query.filter_by(record_id=record_id).first()
        if not gen_record:
            gen_record = GeneralRecord(record_id=record_id)
            db.session.add(gen_record)
            db.session.flush()
            
        count = get_next_visit_sequence_and_increment(patient.clinic_id)
        generated_visit_number = generate_visit_number(count)

        role_str = str(current_role).strip().lower()
        
        if role_str in ["midwife"]:
            initial_status = "approved"
        else:
            initial_status = "pending"

        new_visit = VisitMaster(
            record_id=record_id,
            user_id=current_user.user_id,
            clinic_id=patient.clinic_id,
            visit_number=data.get("visit_number"),
            visit_date=visit_date,
            visit_time=now_local,
            visit_status=initial_status
        )
        db.session.add(new_visit)
        db.session.flush()

        new_general_visit = VisitGeneral(
            visit_id=new_visit.visit_id,
            gr_id=gen_record.gr_id,
            subjective=data.get("subjective"),
            objective=data.get("objective"),
            assessment=data.get("assessment"),
            plan=data.get("plan"),
        )
        db.session.add(new_general_visit)

        create_financial_for_visit(
            visit_id=new_visit.visit_id,
            user_id=current_user.user_id,
            patient_id=record.patient_id,
            clinic_id=patient.clinic_id,
            record_number=record.record_number,
            patient_name=get_patient_display_name(patient),
            data=data,
            payment_date=now_local,
            visit_status=initial_status,
        )
        record.last_update = now_local
        db.session.commit()

        return jsonify({
            "msg": "Kunjungan berhasil ditambahkan.",
            "rm_number": str(new_visit.record_id),
            "visit_id": str(new_visit.visit_id),
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/get-visit-general/<uuid>", methods=["GET"])
@jwt_required()
def get_general_visit(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(uuid, current_user, current_role)

        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        current_general_visit = VisitGeneral.query.filter_by(visit_id=uuid).first()
        if not current_general_visit:
            return jsonify({"msg": "Data kunjungan umum tidak ditemukan."}), 404

        current_finance = get_visit_finance(uuid)

        return jsonify({
            "subjective": safe_decrypt(current_general_visit.subjective),
            "objective": safe_decrypt(current_general_visit.objective),
            "assessment": safe_decrypt(current_general_visit.assessment),
            "plan": safe_decrypt(current_general_visit.plan),
            "finance": {
                "invoice_number": current_finance.transaction_number if current_finance else "-",
                "total_amount": current_finance.amount if current_finance else 0,
                "payment_method": current_finance.payment_method if current_finance else "-",
                "status": current_finance.status if current_finance else "-",
            },
        }), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/update-visit-general/<uuid>", methods=["PUT"])
@jwt_required()
def update_general_visit_report(uuid):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        data = request.get_json() or {}
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong."}), 400

        visit_id_str = str(uuid)

        result = get_visit_for_user(uuid, current_user, current_role)
        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        current_general_visit = VisitGeneral.query.filter_by(visit_id=uuid).first()
        if not current_general_visit:
            return jsonify({"msg": "Data kunjungan umum tidak ditemukan."}), 404

        current_general_visit.subjective = data.get("subjective", "")
        current_general_visit.objective = data.get("objective", "")
        current_general_visit.assessment = data.get("assessment", "")
        current_general_visit.plan = data.get("plan", "")

        visit_base = result[0] if isinstance(result, tuple) else result
        if visit_base and hasattr(visit_base, 'record_id') and visit_base.record_id:
            db.session.query(MedicalRecord).filter(
                MedicalRecord.medical_record_id == visit_base.record_id 
            ).update({"last_update": datetime.now()})

        role_str = str(current_role).strip().lower()
        if role_str in ["asisten", "assistant", "staff"]:
                visit_master = VisitMaster.query.filter_by(visit_id=visit_id_str).first()            
                if visit_master:
                    visit_master.visit_status = "pending"

        db.session.commit()

        return jsonify({"msg": "Catatan medis SOAP berhasil diperbarui.", "visit_id": str(uuid)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500


@visit_report_bp.route("/delete-visit/<uuid:visit_id>", methods=["DELETE"])
@jwt_required()
def delete_visit(visit_id):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        result = get_visit_for_user(str(visit_id), current_user, current_role)
        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan atau bukan milik klinik Anda."}), 404

        visit, medical_record, patient, user = result

        VisitGeneral.query.filter_by(visit_id=visit_id).delete()
        VisitPregnancy.query.filter_by(visit_id=visit_id).delete()
        VisitFamilyPlanning.query.filter_by(visit_id=visit_id).delete()
        VisitImunization.query.filter_by(visit_id=visit_id).delete()
        Financial.query.filter_by(visit_id=visit_id).delete()

        db.session.delete(visit)
        db.session.commit()

        return jsonify({"msg": "Data kunjungan dan invoice terkait berhasil dihapus."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menghapus data kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/search-visit", methods=["GET"])
@jwt_required()
def search_visit():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        search_query = request.args.get("query", "").strip().lower()

        results = query_visits_for_user(current_user, current_role).all()
        matched_records = []

        for visit, medical_record, patient, user in results:
            decrypted_name = safe_decrypt(patient.patient_name)
            decrypted_nik = safe_decrypt(patient.national_id)

            searchable = " ".join([
                str(decrypted_name).lower(),
                str(decrypted_nik).lower(),
                str(medical_record.record_number).lower(),
                str(visit.visit_number).lower(),
            ])

            if search_query and search_query not in searchable:
                continue

            matched_records.append(serialize_visit_row(visit, medical_record, patient, user))

        return jsonify(matched_records), 200

    except Exception as e:
        return jsonify({"msg": "Gagal mencari data kunjungan.", "error": str(e)}), 500


@visit_report_bp.route("/filter-all", methods=["GET"])
@jwt_required()
def filter_all_visits():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        search_query = request.args.get("search", "").strip().lower()
        rm_type = request.args.get("type", "All")
        start_date = request.args.get("start_date", "")
        end_date = request.args.get("end_date", "")
        status = request.args.get("status", "All")

        query = query_visits_for_user(current_user, current_role)

        if rm_type not in ["All", "Semua"]:
            query = query.filter(MedicalRecord.record_type == rm_type)

        if start_date and end_date:
            query = query.filter(VisitMaster.visit_date.between(start_date, end_date))

        if status not in ["All", "Semua"]:
            query = query.filter(VisitMaster.visit_status == status)

        results = query.order_by(VisitMaster.visit_date.desc(), VisitMaster.visit_time.desc()).all()

        visit_list = []

        for visit, medical_record, patient, user in results:
            decrypted_name = safe_decrypt(patient.patient_name)
            decrypted_nik = safe_decrypt(patient.national_id)

            searchable = " ".join([
                str(decrypted_name).lower(),
                str(decrypted_nik).lower(),
                str(medical_record.record_number).lower(),
                str(visit.visit_number).lower(),
            ])

            if search_query and search_query not in searchable:
                continue

            visit_list.append(serialize_visit_row(visit, medical_record, patient, user))

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Gagal mengambil data kunjungan terfilter.", "error": str(e)}), 500


@visit_report_bp.route("/json-visit", methods=["GET"])
@jwt_required()
def get_json_visit_report():
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    try:
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        visit_type = request.args.get("visit_type", "Semua")
        search_query = request.args.get("search", "").strip().lower()

        query = query_visits_for_user(current_user, current_role)

        query = query.filter(func.lower(VisitMaster.visit_status) == "approved")

        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            query = (
                query
                .filter(db.func.date(VisitMaster.visit_date) >= start_date)
                .filter(db.func.date(VisitMaster.visit_date) <= end_date)
            )

        raw_visits = query.order_by(VisitMaster.visit_date.desc()).all()
        results = []

        for visit, medical_record, patient, user in raw_visits:
            decrypted_name = safe_decrypt(patient.patient_name)
            decrypted_nik = safe_decrypt(patient.national_id)
            birth_date = format_date(patient.birth_date) if patient.birth_date else ""

            searchable = " ".join([
                str(decrypted_name).lower(),
                str(decrypted_nik).lower(),
                str(birth_date).lower(),
                str(medical_record.record_number).lower(),
                str(visit.visit_number).lower(),
            ])

            if search_query and search_query not in searchable:
                continue

            row_data = {
                "visit_id": str(visit.visit_id),
                "visit_number": visit.visit_number,
                "visit_date": visit.visit_date.strftime("%Y-%m-%d %H:%M") if visit.visit_date else "-",
                "record_number": medical_record.record_number,
                "patient_name": str(decrypted_name).title() if decrypted_name else "Unknown",
                "created_by": user.fullname if user else "-",
                "visit_type": get_visit_type_from_detail(visit.visit_id),
            }

            general_detail = VisitGeneral.query.filter_by(visit_id=visit.visit_id).first()
            if general_detail:
                row_data["visit_type"] = "Umum"

                if visit_type in ["Umum", "Semua"]:
                    row_data["subjective"] = safe_decrypt(general_detail.subjective)
                    row_data["objective"] = safe_decrypt(general_detail.objective)
                    row_data["assessment"] = safe_decrypt(general_detail.assessment)
                    row_data["plan"] = safe_decrypt(general_detail.plan)

            pregnancy_detail = VisitPregnancy.query.filter_by(visit_id=visit.visit_id).first()
            if pregnancy_detail:
                row_data["visit_type"] = "Kehamilan"

                if visit_type in ["Kehamilan", "Semua"]:
                    row_data["blood_pressure"] = safe_decrypt(pregnancy_detail.blood_pressure)
                    row_data["weight_kg"] = pregnancy_detail.weight_kg
                    row_data["height_cm"] = pregnancy_detail.height_cm
                    row_data["body_temperature"] = pregnancy_detail.body_temperature
                    row_data["respiratory_rate"] = pregnancy_detail.respiratory_rate
                    row_data["heart_rate"] = pregnancy_detail.heart_rate
                    row_data["subjective"] = safe_decrypt(pregnancy_detail.subjective)
                    row_data["objective"] = safe_decrypt(pregnancy_detail.objective)
                    row_data["assessment"] = safe_decrypt(pregnancy_detail.assessment)
                    row_data["plan"] = safe_decrypt(pregnancy_detail.plan)

            immunization_detail = VisitImunization.query.filter_by(visit_id=visit.visit_id).first()
            if immunization_detail:
                row_data["visit_type"] = "Imunisasi"

                if visit_type in ["Imunisasi", "Semua"]:
                    row_data["baby_weight"] = immunization_detail.baby_weight
                    row_data["baby_height"] = immunization_detail.baby_height
                    row_data["body_temp"] = immunization_detail.body_temp
                    row_data["head_circumference"] = immunization_detail.head_circumference
                    row_data["abdominal_circumference"] = immunization_detail.abdominal_circumference
                    row_data["dosage_given"] = immunization_detail.dosage_given
                    row_data["vaccine_given"] = immunization_detail.vaccine_given

            familyplanning_detail = VisitFamilyPlanning.query.filter_by(visit_id=visit.visit_id).first()
            if familyplanning_detail:
                row_data["visit_type"] = "Keluarga Berencana"

                if visit_type in ["Keluarga Berencana", "Semua"]:
                    row_data["weight_kg"] = familyplanning_detail.weight_kg
                    row_data["blood_pressure"] = familyplanning_detail.blood_pressure
                    row_data["kb_method"] = familyplanning_detail.kb_method
                    row_data["return_visit_date"] = format_date(familyplanning_detail.return_visit_date) if familyplanning_detail.return_visit_date else "-"
                    row_data["complaint"] = safe_decrypt(familyplanning_detail.complaint)

            delivery_detail = DeliveryRecord.query.filter_by(record_id=medical_record.record_id).first()
            if delivery_detail and medical_record.record_type == "Persalinan":
                row_data["visit_type"] = "Persalinan"
                if visit_type in ["Persalinan", "Semua"]:
                    row_data["delivery_date"] = format_date(delivery_detail.delivery_date) if delivery_detail.delivery_date else "-"
                    row_data["delivery_type"] = delivery_detail.delivery_type or "-"
                    row_data["deliver_complications"] = safe_decrypt(delivery_detail.deliver_complications)
                    row_data["baby_gender"] = delivery_detail.baby_gender or "-"
                    row_data["baby_weight"] = delivery_detail.baby_weight or 0
                    row_data["baby_length"] = delivery_detail.baby_length or 0
                    row_data["apgar_score"] = delivery_detail.apgar_score or "-"
                    row_data["baby_complications"] = safe_decrypt(delivery_detail.baby_complications)
                    row_data["vit_k_given"] = delivery_detail.vit_k_given
                    row_data["hbo_given"] = delivery_detail.hbo_given
                    row_data["eye_ointment"] = delivery_detail.eye_ointment
                    row_data["imd"] = delivery_detail.imd

            financial_detail = get_visit_finance(visit.visit_id)
            row_data["amount"] = financial_detail.amount if financial_detail else 0
            row_data["status"] = financial_detail.status if financial_detail else "unpaid"

            if visit_type == "Semua" or row_data["visit_type"] == visit_type:
                results.append(row_data)

        return jsonify({"status": "success", "results": results}), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server.", "error": str(e)}), 500

@visit_report_bp.route("/approve/<uuid:visit_id>", methods=["PATCH"])
@jwt_required()
def approve_visit(visit_id):
    current_user, current_role, error_response = require_visit_access()

    if error_response:
        return error_response

    role_str = str(current_role).strip().lower()
    if role_str not in [ "midwife"]:
        return jsonify({"msg": "Akses ditolak. Hanya Bidan yang dapat menyetujui kunjungan."}), 403

    visit_id_str = str(visit_id)
    visit = VisitMaster.query.get(visit_id_str)
    if not visit:
        return jsonify({"msg": "Data kunjungan tidak ditemukan."}), 404

    if visit.visit_status == "approved":
        return jsonify({"msg": "Kunjungan ini sudah disetujui sebelumnya."}), 200

    visit.visit_status = "approved"

    financial = Financial.query.filter_by(visit_id=visit_id_str).first()
    if financial:
        financial.visit_status = "approved"

    db.session.commit()

    return jsonify({"msg": "Kunjungan berhasil disetujui dan transaksi keuangan telah dicatat."}), 200