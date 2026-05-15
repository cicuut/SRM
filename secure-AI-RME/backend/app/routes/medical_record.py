from flask import Blueprint, request, jsonify
from app.models import db, Patient, MedicalRecord, PregnancyRecord, ObstetricHistory, FamilyPlanningRecord, GeneralRecord, DeliveryRecord, ImmunizationRecord, VisitImunization, VisitMaster, VisitFamilyPlanning, VisitPregnancy, VisitGeneral
from app.utils import generate_record_number, get_latest_record_count, decrypt_data, clean_float, format_date
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt


medical_record_bp = Blueprint("medical_record", __name__)


VALID_GENDERS = ["perempuan", "laki-laki"]
VALID_PATIENT_ROLES = ["self", "family"]
STATUS_ACTIVE = "Active"
STATUS_CLOSED = "Closed"


def to_str(value):
    if value is None:
        return None

    return str(value)


def value_or_dash(value):
    if value is None or value == "":
        return "-"

    return value


def clean_text(value):
    if value is None:
        return None

    value = str(value).strip()

    return value if value else None


def to_float(value):
    if value is None or value == "":
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def to_int(value):
    if value is None or value == "":
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_bool(value):
    if value is None or value == "":
        return False

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in ["true", "1", "yes", "ya", "iya", "on"]:
            return True

        if normalized in ["false", "0", "no", "tidak", "off"]:
            return False

    return bool(value)


def parse_date(value):
    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    raw_value = str(value).strip()

    if not raw_value:
        return None

    if "T" in raw_value:
        raw_value = raw_value.split("T")[0]

    for date_format in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"]:
        try:
            return datetime.strptime(raw_value, date_format).date()
        except ValueError:
            continue

    return None


def parse_datetime(value):
    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        return value

    if isinstance(value, date):
        return datetime.combine(value, time.min)

    raw_value = str(value).strip()

    if not raw_value:
        return None

    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
    except ValueError:
        pass

    parsed_date = parse_date(raw_value)

    if parsed_date:
        return datetime.combine(parsed_date, time.min)

    return None


def format_date(value):
    if not value:
        return "-"

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")

    return str(value)


def format_time(value):
    if not value:
        return "-"

    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")

    return str(value)


def normalize_gender(value):
    raw_value = clean_text(value)

    if not raw_value:
        return None

    normalized = raw_value.lower()

    female_values = ["perempuan", "female", "woman", "wanita", "p", "f"]
    male_values = ["laki-laki", "laki", "male", "man", "pria", "l", "m"]

    if normalized in female_values:
        return "perempuan"

    if normalized in male_values:
        return "laki-laki"

    if raw_value in VALID_GENDERS:
        return raw_value

    raise ValueError("Gender harus bernilai perempuan atau laki-laki")


def normalize_patient_role(value, default_value="self"):
    raw_value = clean_text(value) or default_value
    normalized = raw_value.lower()

    if normalized in ["self", "patient", "pasien", "diri sendiri"]:
        return "self"

    if normalized in ["family", "keluarga"]:
        return "family"

    if raw_value in VALID_PATIENT_ROLES:
        return raw_value

    raise ValueError("Role pasien harus bernilai self atau family")


def normalize_record_status(value=None):
    raw_value = clean_text(value) or STATUS_ACTIVE

    if raw_value.lower() == "active":
        return STATUS_ACTIVE

    if raw_value.lower() == "closed":
        return STATUS_CLOSED

    if raw_value in [STATUS_ACTIVE, STATUS_CLOSED]:
        return raw_value

    return STATUS_ACTIVE


def require_clinic_id():
    claims = get_jwt()
    clinic_id = claims.get("clinic_id")

    if not clinic_id:
        return None, (jsonify({"msg": "Akun belum terhubung ke klinik"}), 400)

    return clinic_id, None


def validate_required(data, required_fields):
    missing_fields = [field for field in required_fields if not data.get(field)]

    if missing_fields:
        return (
            jsonify(
                {
                    "msg": "Tanda * wajib untuk diisi!",
                    "missing_fields": missing_fields,
                }
            ),
            400,
        )

    return None


def create_family_and_patient(data, clinic_id):
    family_id = None

    if data.get("family_name"):
        family_gender = normalize_gender(data.get("family_gender"))

        new_family = Patient(
            patient_name=clean_text(data.get("family_name")),
            birth_date=parse_date(data.get("family_birth_date")),
            national_id=clean_text(data.get("family_national_id")),
            gender=family_gender,
            role="family",
            relation=clean_text(data.get("relation")),
            clinic_id=clinic_id,
            address=clean_text(data.get("family_address")),
            patient_number=clean_text(data.get("family_number")),
            education_level=clean_text(data.get("family_education_level")),
            occupation=clean_text(data.get("family_occupation")),
        )

        db.session.add(new_family)
        db.session.flush()
        family_id = new_family.patient_id

    patient_gender = normalize_gender(data.get("gender"))

    new_patient = Patient(
        patient_name=clean_text(data.get("patient_name")),
        birth_date=parse_date(data.get("birth_date")),
        national_id=clean_text(data.get("national_id")),
        gender=patient_gender,
        clinic_id=clinic_id,
        role="self",
        relation="self",
        patient_number=clean_text(data.get("patient_number")),
        education_level=clean_text(data.get("education_level")),
        occupation=clean_text(data.get("occupation")),
        address=clean_text(data.get("address")),
        insurance_number=clean_text(data.get("insurance_number")),
        primary_health_facility=clean_text(data.get("primary_health_facility")),
        family_link_id=family_id,
    )

    db.session.add(new_patient)
    db.session.flush()

    return new_patient, family_id


def create_medical_record(patient_id, record_number, record_type):
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_number=record_number,
        record_type=record_type,
        status=normalize_record_status(),
        created_at=datetime.utcnow(),
        last_updated=datetime.utcnow(),
    )

    db.session.add(new_record)
    db.session.flush()

    return new_record


def common_required_fields():
    return [
        "family_name",
        "family_birth_date",
        "family_national_id",
        "family_gender",
        "family_address",
        "family_number",
        "relation",
        "patient_name",
        "birth_date",
        "national_id",
        "gender",
        "patient_number",
        "address",
    ]


@medical_record_bp.route("/rm-number", methods=["GET"])
@jwt_required()
def get_next_number():
    record_type = request.args.get("type")

    if not record_type:
        return jsonify({"msg": "Medical Record Type is required"}), 400

    try:
        count = get_latest_record_count(record_type)
        next_rm_number = generate_record_number(record_type, count)

        return (
            jsonify(
                {
                    "record_type": record_type,
                    "next_rm_number": next_rm_number,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"msg": "Failed to generate number", "error": str(e)}), 500


@medical_record_bp.route("/add-pregnancy", methods=["POST"])
@jwt_required()
def add_pregnancy_record():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    data = request.get_json() or {}

    validation_error = validate_required(data, common_required_fields())

    if validation_error:
        return validation_error

    try:
        new_patient, _ = create_family_and_patient(data, clinic_id)

        new_record = create_medical_record(
            patient_id=new_patient.patient_id,
            record_number=data.get("record_number"),
            record_type="Kehamilan",
        )

        new_pregnancy_record = PregnancyRecord(
            record_id=new_record.record_id,
            contraceptive_history=data.get('contraceptive_history'),
            family_med_history=data.get('family_med_history'),
            last_menstrual_period=clean_float(data.get('last_menstrual_period')),
            expected_due_date=clean_float(data.get('expected_due_date')),
            diagnosis=data.get('diagnosis'),
            registration_date = clean_float(data.get('registration_date')),
            height_cm=clean_float(data.get('height_cm')),
            weight_kg=clean_float(data.get('weight_kg')),
            muac_cm=clean_float(data.get('muac_cm')),
            tt_screening=data.get('tt_screening'),
            lab_results=data.get('lab_results'),
            pre_preg_weight_kg=clean_float(data.get('pre_preg_weight_kg')),
            pre_preg_muac_cm=clean_float(data.get('pre_preg_muac_cm')),

        );
        db.session.add(new_pregnancy_record)
        db.session.flush()

        obstetric_list = data.get("obstetric_list", [])

        if isinstance(obstetric_list, list):
            for obs in obstetric_list:
                new_history = ObstetricHistory(
                    pr_id=new_pregnancy_record.pr_id,
                    pregnancy_no=to_int(obs.get("pregnancy_no")),
                    gestational_age=clean_text(obs.get("gestational_age")),
                    pregnancy_complications=clean_text(
                        obs.get("pregnancy_complications")
                    ),
                    delivery_mode=clean_text(obs.get("delivery_mode")),
                    delivery_complications=clean_text(
                        obs.get("delivery_complications")
                    ),
                    baby_height=to_float(obs.get("baby_height")),
                    baby_weight=to_float(obs.get("baby_weight")),
                    baby_complications=clean_text(obs.get("baby_complications")),
                    postpartum_status=clean_text(obs.get("postpartum_status")),
                    postpartum_complications=clean_text(
                        obs.get("postpartum_complications")
                    ),
                )

                db.session.add(new_history)

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Medical record added successfully",
                    "patient_id": str(new_patient.patient_id),
                    "rm_number": new_record.record_number,
                }
            ),
            201,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500


@medical_record_bp.route("/add-family-planning", methods=["POST"])
@jwt_required()
def add_family_planning_record():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    data = request.get_json() or {}

    validation_error = validate_required(data, common_required_fields())

    if validation_error:
        return validation_error

    try:
        new_patient, _ = create_family_and_patient(data, clinic_id)

        new_record = create_medical_record(
            patient_id=new_patient.patient_id,
            record_number=data.get("record_number"),
            record_type="Keluarga Berencana",
        )

        new_family_planning_record = FamilyPlanningRecord(
            record_id=new_record.record_id,
            number_of_children=to_int(data.get("number_of_children")),
            youngest_child_age=clean_text(data.get("youngest_child_age")),
            family_med_history=clean_text(data.get("family_med_history")),
        )

        db.session.add(new_family_planning_record)
        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Medical record added successfully",
                    "patient_id": str(new_patient.patient_id),
                    "rm_number": new_record.record_number,
                }
            ),
            201,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500


@medical_record_bp.route("/add-general", methods=["POST"])
@jwt_required()
def add_general_record():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    data = request.get_json() or {}

    validation_error = validate_required(data, common_required_fields())

    if validation_error:
        return validation_error

    try:
        new_patient, _ = create_family_and_patient(data, clinic_id)

        new_record = create_medical_record(
            patient_id=new_patient.patient_id,
            record_number=data.get("record_number"),
            record_type="Umum",
        )

        new_general_record = GeneralRecord(
            record_id=new_record.record_id,
        )

        db.session.add(new_general_record)
        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Medical record added successfully",
                    "patient_id": str(new_patient.patient_id),
                    "rm_number": new_record.record_number,
                }
            ),
            201,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500


@medical_record_bp.route("/add-immunization", methods=["POST"])
@jwt_required()
def add_immunization_record():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    data = request.get_json() or {}

    validation_error = validate_required(data, common_required_fields())

    if validation_error:
        return validation_error

    try:
        new_patient, _ = create_family_and_patient(data, clinic_id)

        new_record = create_medical_record(
            patient_id=new_patient.patient_id,
            record_number=data.get("record_number"),
            record_type="Imunisasi",
        )

        new_immunization_record = ImmunizationRecord(
            record_id=new_record.record_id,
            hbo_1=parse_date(data.get("hbo_1")),
            bcg_1=parse_date(data.get("bcg_1")),
            polio_1=parse_date(data.get("polio_1")),
            polio_2=parse_date(data.get("polio_2")),
            polio_3=parse_date(data.get("polio_3")),
            polio_4=parse_date(data.get("polio_4")),
            dpt_1=parse_date(data.get("dpt_1")),
            dpt_2=parse_date(data.get("dpt_2")),
            dpt_3=parse_date(data.get("dpt_3")),
            dpt_4=parse_date(data.get("dpt_4")),
            pcv_1=parse_date(data.get("pcv_1")),
            pcv_2=parse_date(data.get("pcv_2")),
            pcv_3=parse_date(data.get("pcv_3")),
            rotavirus_1=parse_date(data.get("rotavirus_1")),
            rotavirus_2=parse_date(data.get("rotavirus_2")),
            rotavirus_3=parse_date(data.get("rotavirus_3")),
            campak_1=parse_date(data.get("campak_1")),
            campak_2=parse_date(data.get("campak_2")),
            ipv_1=parse_date(data.get("ipv_1")),
            ipv_2=parse_date(data.get("ipv_2")),
        )

        db.session.add(new_immunization_record)
        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Medical record added successfully",
                    "patient_id": str(new_patient.patient_id),
                    "rm_number": new_record.record_number,
                }
            ),
            201,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500


@medical_record_bp.route("/add-delivery", methods=["POST"])
@jwt_required()
def add_delivery_record():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    data = request.get_json() or {}

    validation_error = validate_required(data, common_required_fields())

    if validation_error:
        return validation_error

    try:
        new_patient, _ = create_family_and_patient(data, clinic_id)

        new_record = create_medical_record(
            patient_id=new_patient.patient_id,
            record_number=data.get("record_number"),
            record_type="Persalinan",
        )

        baby_gender = None

        if data.get("baby_gender"):
            baby_gender = normalize_gender(data.get("baby_gender"))

        baby_length = data.get("baby_length")

        if baby_length is None:
            baby_length = data.get("baby_lenght")

        new_delivery_record = DeliveryRecord(
            record_id=new_record.record_id,
            delivery_date=parse_datetime(data.get("delivery_date")),
            delivery_type=clean_text(data.get("delivery_type")),
            deliver_complications=clean_text(data.get("deliver_complications")),
            baby_gender=baby_gender,
            baby_weight=to_float(data.get("baby_weight")),
            baby_length=to_float(baby_length),
            apgar_score=clean_text(data.get("apgar_score")),
            baby_complications=clean_text(data.get("baby_complications")),
            vit_k_given=to_bool(data.get("vit_k_given")),
            hbo_given=to_bool(data.get("hbo_given")),
            eye_ointment=to_bool(data.get("eye_ointment")),
            imd=to_bool(data.get("imd")),
        )

        db.session.add(new_delivery_record)
        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Medical record added successfully",
                    "patient_id": str(new_patient.patient_id),
                    "rm_number": new_record.record_number,
                }
            ),
            201,
        )

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal Menambahkan Rekam Medis", "error": str(e)}), 500


@medical_record_bp.route("/get-all-records", methods=["GET"])
@jwt_required()
def get_all_records():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    try:
        results = db.session.query(MedicalRecord, Patient).\
            join(Patient, MedicalRecord.patient_id == Patient.patient_id).\
            all()

        record_list = []

        for record, patient in results:
            record_list.append(
                {
                    "rm_id": str(record.record_id),
                    "record_number": record.record_number,
                    "record_type": record.record_type,
                    "patient_name": value_or_dash(patient.patient_name),
                    "nik": value_or_dash(patient.national_id),
                    "birth_date": format_date(patient.birth_date),
                    "status": record.status,
                    "created_at": format_date(record.created_at),
                    "updated_at": format_date(record.last_updated),
                }
            )

        return jsonify(record_list), 200

    except Exception as e:
        return jsonify({"msg": "Gagal mengambil data", "error": str(e)}), 500


@medical_record_bp.route("/get-record/<uuid>", methods=["GET"])
@jwt_required()
def get_record_detail(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Data tidak ditemukan"}), 404

        patient = Patient.query.get(record.patient_id)

        response_data = {
            "record_number": record.record_number,
            "record_type": record.record_type,
            "patient_name": value_or_dash(patient.patient_name if patient else None),
            "created_at": format_date(record.created_at),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-patient-data/<uuid>", methods=["GET"])
@jwt_required()
def get_patient_data(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Data tidak ditemukan"}), 404

        patient = Patient.query.get(record.patient_id)

        if not patient:
            return jsonify({"msg": "Pasien tidak ditemukan"}), 404

        response_data = {
            "patient_name": value_or_dash(patient.patient_name),
            "nik": value_or_dash(patient.national_id),
            "birthdate": format_date(patient.birth_date),
            "patient_number": value_or_dash(patient.patient_number),
            "gender": patient.gender,
            "age": patient.age,
            "type": record.record_type,
            "address": value_or_dash(patient.address),
            "education": patient.education_level or "-",
            "occupation": patient.occupation or "-",
            "bpjs_number": value_or_dash(patient.insurance_number),
            "primary_healthcare": patient.primary_health_facility or "-",
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-family-data/<uuid>", methods=["GET"])
@jwt_required()
def get_family_data(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        current_patient = Patient.query.get(record.patient_id)

        if not current_patient:
            return jsonify({"msg": "Pasien tidak ditemukan"}), 404

        family_person = None

        if current_patient.role == "self" and current_patient.family_link_id:
            family_person = Patient.query.get(current_patient.family_link_id)

        if not family_person:
            return jsonify({"msg": "Data Keluarga tidak ditemukan", "data": None}), 200

        response_data = {
            "patient_name": value_or_dash(family_person.patient_name),
            "nik": value_or_dash(family_person.national_id),
            "birthdate": format_date(family_person.birth_date),
            "gender": family_person.gender,
            "age": family_person.age,
            "relation": family_person.relation,
            "patient_number": value_or_dash(family_person.patient_number),
            "occupation": family_person.occupation or "-",
            "education": family_person.education_level or "-",
            "address": value_or_dash(family_person.address),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-pregnancy-record-data/<uuid>", methods=["GET"])
@jwt_required()
def get_pregnancy_record_data(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        current_pregnancy_record = PregnancyRecord.query.filter_by(
            record_id=str(uuid)
        ).first()

        if not current_pregnancy_record:
            return jsonify({"msg": "Data kehamilan tidak ditemukan"}), 404

        current_obstetric_history = ObstetricHistory.query.filter_by(
            pr_id=current_pregnancy_record.pr_id
        ).all()

        obstetric_history_list = []

        for obs in current_obstetric_history:
            obstetric_history_list.append(
                {
                    "id": str(obs.history_id),
                    "pregnancy_no": obs.pregnancy_no or "-",
                    "gestational_age": obs.gestational_age or "-",
                    "pregnancy_complications": value_or_dash(
                        obs.pregnancy_complications
                    ),
                    "delivery_mode": obs.delivery_mode or "-",
                    "delivery_complications": value_or_dash(
                        obs.delivery_complications
                    ),
                    "baby_weight": obs.baby_weight or "-",
                    "baby_height": obs.baby_height or "-",
                    "baby_complications": value_or_dash(obs.baby_complications),
                    "postpartum_status": value_or_dash(obs.postpartum_status),
                    "postpartum_complications": value_or_dash(
                        obs.postpartum_complications
                    ),
                }
            )

        response_data = {
            "current_pregnancy": {
                "contraceptive_history": value_or_dash(
                    current_pregnancy_record.contraceptive_history
                ),
                "family_med_history": value_or_dash(
                    current_pregnancy_record.family_med_history
                ),
                "last_menstrual_period": format_date(
                    current_pregnancy_record.last_menstrual_period
                ),
                "expected_due_date": format_date(
                    current_pregnancy_record.expected_due_date
                ),
                "diagnosis": value_or_dash(current_pregnancy_record.diagnosis),
                "height_cm": current_pregnancy_record.height_cm or "-",
                "weight_kg": current_pregnancy_record.weight_kg or "-",
                "muac_cm": current_pregnancy_record.muac_cm or "-",
                "pre_preg_weight_kg": current_pregnancy_record.pre_preg_weight_kg
                or "-",
                "pre_preg_muac_cm": current_pregnancy_record.pre_preg_muac_cm or "-",
                "tt_screening": current_pregnancy_record.tt_screening or "-",
                "lab_results": value_or_dash(current_pregnancy_record.lab_results),
                "registration_date": format_date(
                    current_pregnancy_record.registration_date
                ),
            },
            "past_obstetric_history": obstetric_history_list,
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-pregnancy-visit-data/<uuid>", methods=["GET"])
@jwt_required()
def get_pregnancy_visit_data(uuid):
    try:
        results = (
            db.session.query(VisitMaster, VisitPregnancy)
            .join(VisitPregnancy, VisitMaster.visit_id == VisitPregnancy.visit_id)
            .filter(VisitMaster.record_id == str(uuid))
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []

        for master, detail in results:
            visit_list.append(
                {
                    "visit_id": str(master.visit_id),
                    "visit_date": format_date(master.visit_date),
                    "visit_time": format_time(master.visit_time),
                    "weight": detail.weight_kg or "-",
                    "height": detail.height_cm or "-",
                    "blood_pressure": detail.blood_pressure or "-",
                    "body_temperature": detail.body_temperature or "-",
                    "respiratory_rate": detail.respiratory_rate or "-",
                    "heart_rate": detail.heart_rate or "-",
                    "subjective": value_or_dash(detail.subjective),
                    "objective": value_or_dash(detail.objective),
                    "assessment": value_or_dash(detail.assessment),
                    "plan": value_or_dash(detail.plan),
                }
            )

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-family-planning-record-data/<uuid>", methods=["GET"])
@jwt_required()
def get_family_planning_record_data(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        current_family_planning_record = FamilyPlanningRecord.query.filter_by(
            record_id=str(uuid)
        ).first()

        if not current_family_planning_record:
            return jsonify({"msg": "Rekam medis KB tidak ditemukan"}), 404

        response_data = {
            "number_of_children": current_family_planning_record.number_of_children
            or "-",
            "family_med_history": value_or_dash(
                current_family_planning_record.family_med_history
            ),
            "youngest_child_age": current_family_planning_record.youngest_child_age
            or "-",
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-family-planning-visit-data/<uuid>", methods=["GET"])
@jwt_required()
def get_family_planning_visit_data(uuid):
    try:
        results = (
            db.session.query(VisitMaster, VisitFamilyPlanning)
            .join(
                VisitFamilyPlanning,
                VisitMaster.visit_id == VisitFamilyPlanning.visit_id,
            )
            .filter(VisitMaster.record_id == str(uuid))
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []

        for master, detail in results:
            visit_list.append(
                {
                    "visit_id": str(master.visit_id),
                    "visit_date": format_date(master.visit_date),
                    "visit_time": format_time(master.visit_time),
                    "weight": detail.weight_kg or "-",
                    "blood_pressure": detail.blood_pressure or "-",
                    "contraceptive_method": detail.kb_method or "-",
                    "follow_up_visit": format_date(detail.return_visit_date),
                    "complaints": value_or_dash(detail.complaint),
                }
            )

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-delivery-record-data/<uuid>", methods=["GET"])
@jwt_required()
def get_delivery_record_data(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        current_delivery_record = DeliveryRecord.query.filter_by(
            record_id=str(uuid)
        ).first()

        if not current_delivery_record:
            return jsonify({"msg": "Data Persalinan tidak ditemukan"}), 404

        response_data = {
            "delivery_date": format_date(current_delivery_record.delivery_date),
            "delivery_type": current_delivery_record.delivery_type or "-",
            "deliver_complications": value_or_dash(
                current_delivery_record.deliver_complications
            ),
            "baby_gender": current_delivery_record.baby_gender or "-",
            "apgar_score": current_delivery_record.apgar_score or "-",
            "baby_complications": value_or_dash(
                current_delivery_record.baby_complications
            ),
            "vit_k_given": current_delivery_record.vit_k_given,
            "hbo_given": current_delivery_record.hbo_given,
            "eye_ointment": current_delivery_record.eye_ointment,
            "imd": current_delivery_record.imd,
            "baby_length": current_delivery_record.baby_length or "-",
            "baby_weight": current_delivery_record.baby_weight or "-",
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-immunization-record-data/<uuid>", methods=["GET"])
@jwt_required()
def get_immunization_record_data(uuid):
    try:
        record = MedicalRecord.query.filter_by(record_id=str(uuid)).first()

        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        current_immunization_record = ImmunizationRecord.query.filter_by(
            record_id=str(uuid)
        ).first()

        if not current_immunization_record:
            return jsonify({"msg": "Data Bayi tidak ditemukan"}), 404

        response_data = {
            "hbo_1": format_date(current_immunization_record.hbo_1),
            "bcg_1": format_date(current_immunization_record.bcg_1),
            "polio_1": format_date(current_immunization_record.polio_1),
            "polio_2": format_date(current_immunization_record.polio_2),
            "polio_3": format_date(current_immunization_record.polio_3),
            "polio_4": format_date(current_immunization_record.polio_4),
            "dpt_1": format_date(current_immunization_record.dpt_1),
            "dpt_2": format_date(current_immunization_record.dpt_2),
            "dpt_3": format_date(current_immunization_record.dpt_3),
            "dpt_4": format_date(current_immunization_record.dpt_4),
            "pcv_1": format_date(current_immunization_record.pcv_1),
            "pcv_2": format_date(current_immunization_record.pcv_2),
            "pcv_3": format_date(current_immunization_record.pcv_3),
            "campak_1": format_date(current_immunization_record.campak_1),
            "campak_2": format_date(current_immunization_record.campak_2),
            "ipv_1": format_date(current_immunization_record.ipv_1),
            "ipv_2": format_date(current_immunization_record.ipv_2),
            "rotavirus_1": format_date(current_immunization_record.rotavirus_1),
            "rotavirus_2": format_date(current_immunization_record.rotavirus_2),
            "rotavirus_3": format_date(current_immunization_record.rotavirus_3),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-immunization-visit-data/<uuid>", methods=["GET"])
@jwt_required()
def get_immunization_visit_data(uuid):
    try:
        results = (
            db.session.query(VisitMaster, VisitImunization)
            .join(VisitImunization, VisitMaster.visit_id == VisitImunization.visit_id)
            .filter(VisitMaster.record_id == str(uuid))
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []

        for master, detail in results:
            visit_list.append(
                {
                    "visit_id": str(master.visit_id),
                    "visit_date": format_date(master.visit_date),
                    "visit_time": format_time(master.visit_time),
                    "height": detail.baby_height or "-",
                    "weight": detail.baby_weight or "-",
                    "body_temperature": detail.body_temp or "-",
                    "head_circumference": detail.head_circumference or "-",
                    "abdominal_circumference": detail.abdominal_circumference
                    or "-",
                    "vaccine": detail.vaccine_given or "-",
                    "dosage": detail.dosage_given or "-",
                }
            )

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/get-general-visit-data/<uuid>", methods=["GET"])
@jwt_required()
def get_general_visit_data(uuid):
    try:
        results = (
            db.session.query(VisitMaster, VisitGeneral)
            .join(VisitGeneral, VisitMaster.visit_id == VisitGeneral.visit_id)
            .filter(VisitMaster.record_id == str(uuid))
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []

        for master, detail in results:
            visit_list.append(
                {
                    "visit_id": str(master.visit_id),
                    "visit_date": format_date(master.visit_date),
                    "visit_time": format_time(master.visit_time),
                    "subjective": value_or_dash(detail.subjective),
                    "objective": value_or_dash(detail.objective),
                    "assessment": value_or_dash(detail.assessment),
                    "plan": value_or_dash(detail.plan),
                }
            )

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@medical_record_bp.route("/search-patients", methods=["GET"])
@jwt_required()
def search_patients():
    clinic_id, error_response = require_clinic_id()

    if error_response:
        return error_response

    try:
        search_query = request.args.get("query", "").lower()

        results = (
            db.session.query(MedicalRecord, Patient)
            .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
            .filter(Patient.clinic_id == clinic_id)
            .all()
        )

        matched_records = []

        for record, patient in results:
            decrypted_name = decrypt_data(patient.patient_name).lower()
            decrypted_nik = decrypt_data(patient.national_id)
            
            decrypted_birthdate = decrypt_data(patient.birth_date)
            
            dob_searchable = ""
            dob_display = "-"
            
            if decrypted_birthdate:
                decrypted_str = str(decrypted_birthdate)
                
                try:
                    dob_obj = datetime.strptime(decrypted_str, '%Y-%m-%d')
                    
                    #searchable birth of date format
                    dob_searchable = f"{dob_obj.strftime('%d-%m-%Y')} {dob_obj.strftime('%d/%m/%Y')} {dob_obj.strftime('%Y-%m-%d')} {dob_obj.strftime('%d %B %Y')}".lower()
                    #displayed birth of date
                    dob_display = dob_obj.strftime('%d %B %Y')
                    
                except Exception:
                    dob_searchable = decrypted_str
                    dob_display = decrypted_str
            
            #logic only name, nik, dob
            if (search_query in decrypted_name or 
                search_query in decrypted_nik or 
                search_query in dob_searchable):
                
                matched_records.append({
                    "rm_id": record.record_id,
                    "record_number": record.record_number,
                    "record_type": record.record_type,
                    "patient_name": decrypted_name.title(), 
                    "nik": decrypted_nik,
                    "birth_date": dob_display,
                    "status": record.status
                })

        return jsonify(matched_records), 200

    except Exception as e:
        print(f"Search Error: {str(e)}")
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    