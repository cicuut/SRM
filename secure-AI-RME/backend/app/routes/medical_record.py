from flask import Blueprint, request, jsonify
from app.models import (
    db,
    User,
    Patient,
    MedicalRecord,
    PregnancyRecord,
    ObstetricHistory,
    FamilyPlanningRecord,
    GeneralRecord,
    DeliveryRecord,
    ImmunizationRecord,
    VisitImunization,
    VisitMaster,
    VisitFamilyPlanning,
    VisitPregnancy,
    VisitGeneral,
)
from app.utils import (
    generate_record_number,
    get_next_record_sequence_and_increment,
    decrypt_data,
    clean_float,
    format_date,
    parse_date,
)
from datetime import date, datetime, timedelta
from flask_jwt_extended import jwt_required, get_jwt_identity
import uuid

medical_record_bp = Blueprint('medical_record', __name__)

MEDICAL_RECORD_ALLOWED_ROLES = ['admin', 'midwife', 'asisten']


# -----------------------------------------------------------------------------
# Access helpers
# -----------------------------------------------------------------------------
def to_str(value):
    if value is None:
        return None

    return str(value)


def normalize_role(role):
    normalized = str(role or '').strip().lower()

    role_aliases = {
        'admin': 'admin',
        'developer': 'admin',
        'midwife': 'midwife',
        'bidan': 'midwife',
        'owner': 'midwife',
        'asisten': 'asisten',
        'assistant': 'asisten',
        'staff': 'asisten',
    }

    return role_aliases.get(normalized, normalized)


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_medical_record_access(require_clinic=True):
    current_user = get_current_user()

    if not current_user:
        return None, '', (jsonify({'msg': 'User tidak ditemukan.'}), 404)

    if not current_user.is_active:
        return None, '', (jsonify({'msg': 'Akun Anda sedang tidak aktif.'}), 403)

    current_role = normalize_role(current_user.user_role)

    if current_role not in MEDICAL_RECORD_ALLOWED_ROLES:
        return None, current_role, (
            jsonify({'msg': 'Akses ditolak. Role tidak dapat mengakses rekam medis.'}),
            403,
        )

    if require_clinic and not current_user.clinic_id:
        return None, current_role, (
            jsonify({
                'msg': 'Akses ditolak. Akun Anda belum terhubung dengan klinik mana pun.',
                'requires_clinic_setup': current_role == 'midwife',
                'redirect_path': '/register-clinic' if current_role == 'midwife' else '/login',
            }),
            400,
        )
    
    if current_user.clinic_id:
        try:
            one_year_ago = datetime.now() - timedelta(days=365)
            
            db.session.query(MedicalRecord).filter(
                MedicalRecord.clinic_id == current_user.clinic_id,
                MedicalRecord.status == 'Active',
                MedicalRecord.last_update < one_year_ago
            ).update({MedicalRecord.status: 'Inactive'}, synchronize_session=False)
            
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            print(f"Gagal mendeteksi data: {str(e)}")

    return current_user, current_role, None


def require_clinic_for_write():
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return None, '', None, error_response

    if not current_user.clinic_id:
        return None, current_role, None, (
            jsonify({
                'msg': 'Akun ini tidak terhubung dengan klinik, sehingga tidak dapat membuat data rekam medis.',
            }),
            400,
        )

    return current_user, current_role, current_user.clinic_id, None


def apply_clinic_scope_to_record_query(query, current_user, current_role):
    if current_user.clinic_id:
        clinic_uuid = uuid.UUID(str(current_user.clinic_id))
        
        query = query.filter(
            MedicalRecord.clinic_id == clinic_uuid,
            Patient.clinic_id == clinic_uuid
        )
    else:
        query = query.filter(MedicalRecord.clinic_id == None)

    return query


def base_record_query(current_user, current_role):
    query = db.session.query(MedicalRecord, Patient).join(
        Patient,
        MedicalRecord.patient_id == Patient.patient_id,
    )

    return apply_clinic_scope_to_record_query(query, current_user, current_role)


def get_record_with_patient(record_id, current_user, current_role):
    query = base_record_query(current_user, current_role).filter(
        MedicalRecord.record_id == str(record_id),
    )

    return query.first()


def get_record_or_404(record_id, current_user, current_role):
    row = get_record_with_patient(record_id, current_user, current_role)

    if not row:
        return None, None, (jsonify({'msg': 'Data rekam medis tidak ditemukan.'}), 404)

    record, patient = row

    return record, patient, None


def safe_decrypt(value, fallback='-'):
    if value is None:
        return fallback

    try:
        decrypted = decrypt_data(value)
        if decrypted is None or decrypted == '':
            return fallback
        return decrypted
    except Exception:
        return str(value) if value not in [None, ''] else fallback


def format_birth_date_for_search(raw_birthdate):
    dob_searchable = ''
    dob_display = '-'

    if raw_birthdate:
        decrypted_str = str(raw_birthdate)

        try:
            dob_obj = datetime.strptime(decrypted_str[:10], '%Y-%m-%d')

            indonesian_months = {
                1: 'Januari',
                2: 'Februari',
                3: 'Maret',
                4: 'April',
                5: 'Mei',
                6: 'Juni',
                7: 'Juli',
                8: 'Agustus',
                9: 'September',
                10: 'Oktober',
                11: 'November',
                12: 'Desember',
            }

            bulan_indo = indonesian_months[dob_obj.month]
            dob_searchable = (
                f"{dob_obj.strftime('%d-%m-%Y')} "
                f"{dob_obj.strftime('%d/%m/%Y')} "
                f"{dob_obj.strftime('%Y-%m-%d')} "
                f"{dob_obj.day} {bulan_indo} {dob_obj.year}"
            ).lower()
            dob_display = f"{dob_obj.day:02d} {bulan_indo} {dob_obj.year}"
        except Exception:
            dob_searchable = decrypted_str.lower()
            dob_display = decrypted_str

    return dob_searchable, dob_display


def serialize_record_list_item(record, patient):
    decrypted_name = safe_decrypt(patient.patient_name, fallback='Unknown')
    decrypted_nik = safe_decrypt(patient.national_id, fallback='-')

    return {
        'rm_id': record.record_id,
        'record_number': record.record_number,
        'record_type': record.record_type,
        'patient_name': str(decrypted_name).title(),
        'nik': decrypted_nik,
        'birth_date': format_date(patient.birth_date),
        'status': record.status,
        'created_at': format_date(record.created_at),
        'updated_at': format_date(record.last_update) if record.last_update else '-',
    }


# -----------------------------------------------------------------------------
# Medical record number
# -----------------------------------------------------------------------------
@medical_record_bp.route('/rm-number', methods=['GET'])
@jwt_required()
def get_next_number():
    _current_user, _current_role, error_response = require_medical_record_access()

    if error_response:
        return error_response

    record_type = request.args.get('type')

    if not record_type:
        return jsonify({'msg': 'Tipe rekam medis wajib diisi.'}), 400

    try:
        clinic_id = _current_user.clinic_id
        
        if not clinic_id:
            return jsonify({'msg': 'Akun Anda belum terikat dengan klinik mana pun.'}), 400
        
        count = get_next_record_sequence_and_increment(record_type, clinic_id)
        next_rm_number = generate_record_number(record_type, count)

        return jsonify({
            'record_type': record_type,
            'next_rm_number': next_rm_number,
        }), 200

    except Exception as e:
        return jsonify({'msg': 'Gagal membuat nomor rekam medis.', 'error': str(e)}), 500


# -----------------------------------------------------------------------------
# Add records
# -----------------------------------------------------------------------------
def validate_required_fields(data, required_fields):
    for field in required_fields:
        if not data.get(field):
            return False

    return True


def create_family_patient_if_present(data, current_clinic_id):
    family_id = None

    if data.get('family_name'):
        new_family = Patient(
            patient_name=data.get('family_name'),
            birth_date=data.get('family_birth_date'),
            national_id=data.get('family_national_id'),
            gender=data.get('family_gender'),
            role='family',
            relation=data.get('relation'),
            clinic_id=current_clinic_id,
            address=data.get('family_address'),
            patient_number=data.get('family_number'),
            education_level=data.get('family_education_level'),
            occupation=data.get('family_occupation'),
        )
        db.session.add(new_family)
        db.session.flush()
        family_id = new_family.patient_id

    return family_id


def create_patient_and_record(data, current_clinic_id, record_type):
    import uuid
    clinic_uuid = uuid.UUID(str(current_clinic_id)) if current_clinic_id else None

    family_id = create_family_patient_if_present(data, current_clinic_id)

    new_patient = Patient(
        patient_name=data.get('patient_name'),
        birth_date=data.get('birth_date'),
        national_id=data.get('national_id'),
        gender=data.get('gender'),
        clinic_id=clinic_uuid,
        role='self',
        relation='self',
        patient_number=data.get('patient_number'),
        education_level=data.get('education_level'),
        occupation=data.get('occupation'),
        address=data.get('address'),
        insurance_number=data.get('insurance_number'),
        primary_health_facility=data.get('primary_health_facility'),
        family_link_id=family_id,
    )
    db.session.add(new_patient)
    db.session.flush()
    
    count = get_next_record_sequence_and_increment(record_type, clinic_uuid)
    auto_record_number = generate_record_number(record_type, count)
    current_time = datetime.now()
    
    new_record = MedicalRecord(
        patient_id=new_patient.patient_id,
        record_number=auto_record_number,
        record_type=record_type,
        clinic_id=clinic_uuid,
        status='Active',
        created_at=current_time,
        last_update=current_time,
    )

    db.session.add(new_record)
    db.session.flush()

    return new_patient, new_record


def get_add_record_required_fields():
    return [
        'family_name',
        'family_birth_date',
        'family_national_id',
        'family_gender',
        'family_address',
        'family_number',
        'relation',
        'patient_name',
        'birth_date',
        'national_id',
        'gender',
        'patient_number',
        'address',
    ]

@medical_record_bp.route('/check-nik/<nik_query>', methods=['GET'])
@jwt_required()
def check_duplicate_nik(nik_query):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)
    if error_response:
        return error_response

    target_nik = str(nik_query).strip()

    try:
        patients = Patient.query.filter_by(clinic_id=current_user.clinic_id, role='self').all()
        
        for p in patients:
            if safe_decrypt(p.national_id) == target_nik:
                
                family_data = {
                    'family_name': '', 'family_nik': '', 'family_birthdate': '',
                    'family_gender': '', 'relation': '', 'family_address': '',
                    'family_number': '', 'family_education': '', 'family_occupation': ''
                }
                
                if p.family_link_id:
                    family_person = Patient.query.filter_by(
                        patient_id=p.family_link_id, 
                        clinic_id=current_user.clinic_id
                    ).first()
                    
                    if family_person:
                        family_data = {
                            'family_name': safe_decrypt(family_person.patient_name).title(),
                            'family_nik': safe_decrypt(family_person.national_id),
                            'family_birthdate': family_person.birth_date.strftime('%Y-%m-%d') if family_person.birth_date else '',
                            'family_gender': family_person.gender,
                            'relation': family_person.relation or '-',
                            'family_address': safe_decrypt(family_person.address),
                            'family_number': safe_decrypt(family_person.patient_number),
                            'family_education': family_person.education_level or '-',
                            'family_occupation': family_person.occupation or '-'
                        }

                return jsonify({
                    'exists': True,
                    'msg': 'NIK terdaftar! Data pasien dan keluarga akan langsung terisi.',
                    'patient_data': {
                        'patient_name': safe_decrypt(p.patient_name).title(),
                        'birth_date': p.birth_date.strftime('%Y-%m-%d') if p.birth_date else '',
                        'gender': p.gender,
                        'patient_number': safe_decrypt(p.patient_number),
                        'education_level': p.education_level or '-',
                        'occupation': p.occupation or '-',
                        'address': safe_decrypt(p.address),
                        'insurance_number': safe_decrypt(p.insurance_number),
                        'primary_health_facility': p.primary_health_facility or '-'
                    },
                    'family_data': family_data
                }), 200
                
        
        return jsonify({'exists': False, 'msg': 'NIK belum terdaftar. Silakan input data baru.'}), 200

    except Exception as e:
        return jsonify({'msg': 'Gagal memeriksa NIK sistem.', 'error': str(e)}), 500
@medical_record_bp.route('/add-pregnancy', methods=['POST'])
@jwt_required()
def add_pregnancy_record():
    _current_user, _current_role, current_clinic_id, error_response = require_clinic_for_write()

    if error_response:
        return error_response

    data = request.get_json() or {}

    if not validate_required_fields(data, get_add_record_required_fields()):
        return jsonify({'msg': 'Tanda * wajib untuk diisi!'}), 400

    try:
        new_patient, new_record = create_patient_and_record(data, current_clinic_id, 'Kehamilan')

        new_pregnancy_record = PregnancyRecord(
            record_id=new_record.record_id,
            contraceptive_history=data.get('contraceptive_history'),
            family_med_history=data.get('family_med_history'),
            last_menstrual_period=parse_date(data.get('last_menstrual_period')),
            expected_due_date=parse_date(data.get('expected_due_date')),
            diagnosis=data.get('diagnosis'),
            registration_date=parse_date(data.get('registration_date')),
            height_cm=clean_float(data.get('height_cm')),
            weight_kg=clean_float(data.get('weight_kg')),
            muac_cm=clean_float(data.get('muac_cm')),
            tt_screening=data.get('tt_screening'),
            lab_results=data.get('lab_results'),
            pre_preg_weight_kg=clean_float(data.get('pre_preg_weight_kg')),
            pre_preg_muac_cm=clean_float(data.get('pre_preg_muac_cm')),
        )
        db.session.add(new_pregnancy_record)
        db.session.flush()

        obstetric_list = data.get('obstetric_list', [])

        for obs in obstetric_list:
            new_history = ObstetricHistory(
                pr_id=new_pregnancy_record.pr_id,
                pregnancy_no=obs.get('pregnancy_no'),
                gestational_age=obs.get('gestational_age'),
                pregnancy_complications=obs.get('pregnancy_complications'),
                delivery_mode=obs.get('delivery_mode'),
                delivery_complications=obs.get('delivery_complications'),
                baby_weight=clean_float(obs.get('baby_weight')),
                baby_height=clean_float(obs.get('baby_height')),
                baby_complications=obs.get('baby_complications'),
                postpartum_status=obs.get('postpartum_status'),
                postpartum_complications=obs.get('postpartum_complications'),
            )
            db.session.add(new_history)

        db.session.commit()

        return jsonify({
            'msg': 'Rekam medis berhasil ditambahkan.',
            'patient_id': str(new_patient.patient_id),
            'rm_number': new_record.record_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Gagal menambahkan rekam medis.', 'error': str(e)}), 500


@medical_record_bp.route('/add-family-planning', methods=['POST'])
@jwt_required()
def add_family_planning_record():
    _current_user, _current_role, current_clinic_id, error_response = require_clinic_for_write()

    if error_response:
        return error_response

    data = request.get_json() or {}

    if not validate_required_fields(data, get_add_record_required_fields()):
        return jsonify({'msg': 'Tanda * wajib untuk diisi!'}), 400

    try:
        new_patient, new_record = create_patient_and_record(data, current_clinic_id, 'Keluarga Berencana')

        new_family_planning_record = FamilyPlanningRecord(
            record_id=new_record.record_id,
            number_of_children=clean_float(data.get('number_of_children')),
            youngest_child_age=data.get('youngest_child_age'),
            family_med_history=data.get('family_med_history'),
        )

        db.session.add(new_family_planning_record)
        db.session.commit()

        return jsonify({
            'msg': 'Rekam medis berhasil ditambahkan.',
            'patient_id': str(new_patient.patient_id),
            'rm_number': new_record.record_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Gagal menambahkan rekam medis.', 'error': str(e)}), 500


@medical_record_bp.route('/add-general', methods=['POST'])
@jwt_required()
def add_general_record():
    _current_user, _current_role, current_clinic_id, error_response = require_clinic_for_write()

    if error_response:
        return error_response

    data = request.get_json() or {}

    if not validate_required_fields(data, get_add_record_required_fields()):
        return jsonify({'msg': 'Tanda * wajib untuk diisi!'}), 400

    try:
        new_patient, new_record = create_patient_and_record(data, current_clinic_id, 'Umum')

        db.session.commit()

        return jsonify({
            'msg': 'Rekam medis berhasil ditambahkan.',
            'patient_id': str(new_patient.patient_id),
            'rm_number': new_record.record_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Gagal menambahkan rekam medis.', 'error': str(e)}), 500


@medical_record_bp.route('/add-immunization', methods=['POST'])
@jwt_required()
def add_immunization_record():
    _current_user, _current_role, current_clinic_id, error_response = require_clinic_for_write()

    if error_response:
        return error_response

    data = request.get_json() or {}

    if not validate_required_fields(data, get_add_record_required_fields()):
        return jsonify({'msg': 'Tanda * wajib untuk diisi!'}), 400

    try:
        new_patient, new_record = create_patient_and_record(data, current_clinic_id, 'Imunisasi')

        new_immunization_record = ImmunizationRecord(record_id=new_record.record_id)
        db.session.add(new_immunization_record)
        db.session.flush()
        db.session.commit()

        return jsonify({
            'msg': 'Rekam medis berhasil ditambahkan.',
            'patient_id': str(new_patient.patient_id),
            'rm_number': new_record.record_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Gagal menambahkan rekam medis.', 'error': str(e)}), 500


@medical_record_bp.route('/add-delivery', methods=['POST'])
@jwt_required()
def add_delivery_record():
    _current_user, _current_role, current_clinic_id, error_response = require_clinic_for_write()

    if error_response:
        return error_response

    data = request.get_json() or {}

    if not validate_required_fields(data, get_add_record_required_fields()):
        return jsonify({'msg': 'Tanda * wajib untuk diisi!'}), 400

    try:
        new_patient, new_record = create_patient_and_record(data, current_clinic_id, 'Persalinan')

        new_delivery_record = DeliveryRecord(
            record_id=new_record.record_id,
            delivery_date=parse_date(data.get('delivery_date')),
            delivery_type=data.get('delivery_type'),
            deliver_complications=data.get('deliver_complications'),
            baby_gender=data.get('baby_gender'),
            baby_weight=clean_float(data.get('baby_weight')),
            baby_length=clean_float(data.get('baby_length') or data.get('baby_lenght')),
            apgar_score=data.get('apgar_score'),
            baby_complications=data.get('baby_complications'),
            vit_k_given=data.get('vit_k_given'),
            hbo_given=data.get('hbo_given'),
            eye_ointment=data.get('eye_ointment'),
            imd=data.get('imd'),
        )

        db.session.add(new_delivery_record)
        db.session.commit()

        return jsonify({
            'msg': 'Rekam medis berhasil ditambahkan.',
            'patient_id': str(new_patient.patient_id),
            'rm_number': new_record.record_number,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Gagal menambahkan rekam medis.', 'error': str(e)}), 500


# -----------------------------------------------------------------------------
# Read records
# -----------------------------------------------------------------------------
@medical_record_bp.route('/get-all-records', methods=['GET'])
@jwt_required()
def get_all_records():
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        results = (
            base_record_query(current_user, current_role)
            .order_by(MedicalRecord.last_update.desc())
            .all()
        )

        record_list = [serialize_record_list_item(record, patient) for record, patient in results]

        return jsonify(record_list), 200
    except Exception as e:
        return jsonify({'msg': 'Gagal mengambil data rekam medis.', 'error': str(e)}), 500


@medical_record_bp.route('/get-record/<uuid>', methods=['GET'])
@jwt_required()
def get_record_detail(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        record, patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        response_data = {
            'record_number': record.record_number,
            'record_type': record.record_type,
            'patient_name': safe_decrypt(patient.patient_name),
            'created_at': format_date(record.created_at),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-patient-data/<uuid>', methods=['GET'])
@jwt_required()
def get_patient_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        record, patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        response_data = {
            'patient_name': safe_decrypt(patient.patient_name),
            'nik': safe_decrypt(patient.national_id),
            'birthdate': format_date(patient.birth_date),
            'patient_number': safe_decrypt(patient.patient_number),
            'gender': patient.gender,
            'age': patient.age,
            'type': record.record_type,
            'address': safe_decrypt(patient.address),
            'education': patient.education_level or '-',
            'occupation': patient.occupation or '-',
            'bpjs_number': safe_decrypt(patient.insurance_number),
            'primary_healthcare': patient.primary_health_facility or '-',
        }
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-family-data/<uuid>', methods=['GET'])
@jwt_required()
def get_family_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, current_patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        family_person = None

        if current_patient.role == 'self' and current_patient.family_link_id:
            family_query = Patient.query.filter_by(patient_id=current_patient.family_link_id)

            if current_role != 'admin':
                family_query = family_query.filter(Patient.clinic_id == current_user.clinic_id)

            family_person = family_query.first()

        if not family_person:
            return jsonify({'msg': 'Data keluarga tidak ditemukan.', 'data': None}), 200

        response_data = {
            'patient_name': safe_decrypt(family_person.patient_name),
            'nik': safe_decrypt(family_person.national_id),
            'birthdate': format_date(family_person.birth_date),
            'gender': family_person.gender,
            'age': family_person.age,
            'relation': family_person.relation,
            'patient_number': safe_decrypt(family_person.patient_number),
            'occupation': family_person.occupation or '-',
            'education': family_person.education_level or '-',
            'address': safe_decrypt(family_person.address),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-pregnancy-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_pregnancy_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        current_pregnancy_record = PregnancyRecord.query.filter_by(record_id=uuid).first()
        if not current_pregnancy_record:
            return jsonify({'msg': 'Data kehamilan tidak ditemukan.'}), 404

        current_obstectric_history = ObstetricHistory.query.filter_by(pr_id=current_pregnancy_record.pr_id).all()

        obstectric_history_list = []
        for obs in current_obstectric_history:
            obstectric_history_list.append({
                'id': obs.history_id,
                'pregnancy_no': obs.pregnancy_no or '-',
                'gestational_age': obs.gestational_age or '-',
                'pregnancy_complications': safe_decrypt(obs.pregnancy_complications),
                'delivery_mode': obs.delivery_mode or '-',
                'delivery_complications': safe_decrypt(obs.delivery_complications),
                'baby_weight': obs.baby_weight or '-',
                'baby_height': obs.baby_height or '-',
                'baby_complications': safe_decrypt(obs.baby_complications),
                'postpartum_status': obs.postpartum_status,
                'postpartum_complications': safe_decrypt(obs.postpartum_complications),
            })

        response_data = {
            'current_pregnancy': {
                'contraceptive_history': safe_decrypt(current_pregnancy_record.contraceptive_history),
                'family_med_history': safe_decrypt(current_pregnancy_record.family_med_history),
                'last_menstrual_period': format_date(current_pregnancy_record.last_menstrual_period),
                'expected_due_date': format_date(current_pregnancy_record.expected_due_date),
                'diagnosis': safe_decrypt(current_pregnancy_record.diagnosis),
                'height_cm': current_pregnancy_record.height_cm or '-',
                'weight_kg': current_pregnancy_record.weight_kg or '-',
                'muac_cm': current_pregnancy_record.muac_cm or '-',
                'pre_preg_weight_kg': current_pregnancy_record.pre_preg_weight_kg or '-',
                'pre_preg_muac_cm': current_pregnancy_record.pre_preg_muac_cm or '-',
                'tt_screening': current_pregnancy_record.tt_screening or '-',
                'lab_results': safe_decrypt(current_pregnancy_record.lab_results),
                'registration_date': format_date(current_pregnancy_record.registration_date),
            },
            'past_obstetric_history': obstectric_history_list,
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-pregnancy-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_pregnancy_visit_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        results = (
            db.session.query(VisitMaster, VisitPregnancy)
            .join(VisitPregnancy, VisitMaster.visit_id == VisitPregnancy.visit_id)
            .filter(VisitMaster.record_id == uuid)
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []
        for master, detail in results:
            visit_list.append({
                'visit_id': master.visit_id,
                'visit_date': format_date(master.visit_date) or '-',
                'visit_time': master.visit_time.strftime('%H:%M') if master.visit_time else '-',
                'weight': detail.weight_kg or '-',
                'height': detail.height_cm or '-',
                'blood_pressure': detail.blood_pressure or '-',
                'body_temperature': detail.body_temperature or '-',
                'respiratory_rate': detail.respiratory_rate or '-',
                'heart_rate': detail.heart_rate or '-',
                'subjective': detail.subjective or '-',
                'objective': detail.objective or '-',
                'assessment': detail.assessment or '-',
                'plan': detail.plan or '-',
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-family-planning-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_family_planning_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        current_family_planning_record = FamilyPlanningRecord.query.filter_by(record_id=uuid).first()
        if not current_family_planning_record:
            return jsonify({'msg': 'Rekam medis KB tidak ditemukan.'}), 404

        response_data = {
            'number_of_children': clean_float(current_family_planning_record.number_of_children) or '-',
            'family_med_history': safe_decrypt(current_family_planning_record.family_med_history),
            'youngest_child_age': current_family_planning_record.youngest_child_age or '-',
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-family-planning-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_family_planning_visit_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        results = (
            db.session.query(VisitMaster, VisitFamilyPlanning)
            .join(VisitFamilyPlanning, VisitMaster.visit_id == VisitFamilyPlanning.visit_id)
            .filter(VisitMaster.record_id == uuid)
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []
        for master, detail in results:
            visit_list.append({
                'visit_id': master.visit_id,
                'visit_date': format_date(master.visit_date),
                'visit_time': master.visit_time.strftime('%H:%M') if master.visit_time else '-',
                'weight': detail.weight_kg or '-',
                'blood_pressure': detail.blood_pressure or '-',
                'contraceptive_method': detail.kb_method,
                'follow_up_visit': format_date(detail.return_visit_date) if detail.return_visit_date else '-',
                'complaints': detail.complaint or '-',
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-delivery-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_delivery_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        current_delivery_record = DeliveryRecord.query.filter_by(record_id=uuid).first()
        if not current_delivery_record:
            return jsonify({'msg': 'Data persalinan tidak ditemukan.'}), 404

        response_data = {
            'delivery_date': format_date(current_delivery_record.delivery_date) or '-',
            'delivery_type': current_delivery_record.delivery_type or '-',
            'deliver_complications': safe_decrypt(current_delivery_record.deliver_complications),
            'baby_gender': current_delivery_record.baby_gender or '-',
            'apgar_score': current_delivery_record.apgar_score or '-',
            'baby_complications': safe_decrypt(current_delivery_record.baby_complications),
            'vit_k_given': current_delivery_record.vit_k_given,
            'hbo_given': current_delivery_record.hbo_given,
            'eye_ointment': current_delivery_record.eye_ointment,
            'imd': current_delivery_record.imd,
            'baby_length': current_delivery_record.baby_length or '-',
            'baby_weight': current_delivery_record.baby_weight or '-',
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-immunization-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_immunization_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        current_immunization_record = ImmunizationRecord.query.filter_by(record_id=uuid).first()
        if not current_immunization_record:
            return jsonify({'msg': 'Data bayi tidak ditemukan.'}), 404

        response_data = {
            'hbo_1': format_date(current_immunization_record.hbo_1),
            'bcg_1': format_date(current_immunization_record.bcg_1),
            'polio_1': format_date(current_immunization_record.polio_1),
            'polio_2': format_date(current_immunization_record.polio_2),
            'polio_3': format_date(current_immunization_record.polio_3),
            'polio_4': format_date(current_immunization_record.polio_4),
            'dpt_1': format_date(current_immunization_record.dpt_1),
            'dpt_2': format_date(current_immunization_record.dpt_2),
            'dpt_3': format_date(current_immunization_record.dpt_3),
            'dpt_4': format_date(current_immunization_record.dpt_4),
            'pcv_1': format_date(current_immunization_record.pcv_1),
            'pcv_2': format_date(current_immunization_record.pcv_2),
            'pcv_3': format_date(current_immunization_record.pcv_3),
            'campak_1': format_date(current_immunization_record.campak_1),
            'campak_2': format_date(current_immunization_record.campak_2),
            'ipv_1': format_date(current_immunization_record.ipv_1),
            'ipv_2': format_date(current_immunization_record.ipv_2),
            'rotavirus_1': format_date(current_immunization_record.rotavirus_1),
            'rotavirus_2': format_date(current_immunization_record.rotavirus_2),
            'rotavirus_3': format_date(current_immunization_record.rotavirus_3),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-immunization-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_immunization_visit_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        results = (
            db.session.query(VisitMaster, VisitImunization)
            .join(VisitImunization, VisitMaster.visit_id == VisitImunization.visit_id)
            .filter(VisitMaster.record_id == uuid)
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []
        for master, detail in results:
            visit_list.append({
                'visit_id': master.visit_id,
                'visit_date': format_date(master.visit_date),
                'visit_time': master.visit_time.strftime('%H:%M') if master.visit_time else '-',
                'height': detail.baby_weight or '-',
                'weight': detail.baby_weight or '-',
                'body_temperature': detail.body_temp or '-',
                'head_circumference': detail.head_circumference or '-',
                'abdominal_circumference': detail.abdominal_circumference or '-',
                'vaccine': detail.vaccine_given or '-',
                'dosage': detail.dosage_given or '-',
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/get-general-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_general_visit_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        _record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        results = (
            db.session.query(VisitMaster, VisitGeneral)
            .join(VisitGeneral, VisitMaster.visit_id == VisitGeneral.visit_id)
            .filter(VisitMaster.record_id == uuid)
            .order_by(VisitMaster.visit_date.desc())
            .all()
        )

        visit_list = []
        for master, detail in results:
            visit_list.append({
                'visit_id': master.visit_id,
                'visit_date': format_date(master.visit_date),
                'visit_time': master.visit_time.strftime('%H:%M') if master.visit_time else '-',
                'subjective': detail.subjective or '-',
                'objective': detail.objective or '-',
                'assessment': detail.assessment or '-',
                'plan': detail.plan or '-',
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


# -----------------------------------------------------------------------------
# Delete / search / filter
# -----------------------------------------------------------------------------
@medical_record_bp.route('/delete-record/<uuid>', methods=['DELETE'])
@jwt_required()
def delete_medical_record(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        medical_record, patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        patient_name = safe_decrypt(patient.patient_name, fallback='Pasien')

        family_id = patient.family_link_id

        db.session.delete(medical_record)
        db.session.delete(patient)
        db.session.flush()

        if family_id:
            family_member = Patient.query.get(family_id)
            if family_member:
                db.session.delete(family_member)
        db.session.commit()

        return jsonify({
            'msg': f'Rekam medis milik {patient_name} berhasil dihapus dari sistem.',
            'record_id': uuid,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'msg': 'Terjadi kesalahan internal server saat mencoba menghapus data rekam medis.',
            'error': str(e),
        }), 500


@medical_record_bp.route('/search-patients', methods=['GET'])
@jwt_required()
def search_patients():
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        search_query = request.args.get('query', '').lower().strip()

        results = base_record_query(current_user, current_role).all()

        matched_records = []

        for record, patient in results:
            decrypted_name = str(safe_decrypt(patient.patient_name, fallback='')).lower()
            decrypted_nik = str(safe_decrypt(patient.national_id, fallback='')).strip().lower()
            decrypted_birthdate = safe_decrypt(patient.birth_date, fallback='')
            dob_searchable, dob_display = format_birth_date_for_search(decrypted_birthdate)

            if (
                search_query in decrypted_name
                or search_query in decrypted_nik
                or search_query in dob_searchable
            ):
                matched_records.append({
                    'rm_id': record.record_id,
                    'record_number': record.record_number,
                    'record_type': record.record_type,
                    'patient_name': decrypted_name.title(),
                    'nik': decrypted_nik,
                    'birth_date': dob_display,
                    'status': record.status,
                    'created_at': format_date(record.created_at),
                    'updated_at': format_date(record.last_update) if record.last_update else '-',
                })

        return jsonify(matched_records), 200

    except Exception as e:
        return jsonify({'msg': 'Terjadi kesalahan saat mencari pasien.', 'error': str(e)}), 500


@medical_record_bp.route('/filter-rm-type', methods=['GET'])
@jwt_required()
def filter_rm_type():
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        search_query = request.args.get("search", "").strip().lower()
        selected_type = request.args.get('type')
        start_date = request.args.get("start_date", "").strip()
        end_date = request.args.get("end_date", "").strip()
        
        query = base_record_query(current_user, current_role)

        if selected_type and selected_type not in ['All', 'Semua', 'Select a type']:
            query = query.filter(MedicalRecord.record_type == selected_type)

        if start_date and end_date:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(
                db.func.date(MedicalRecord.created_at) >= start_date,
                db.func.date(MedicalRecord.created_at) <= end_date
            )

        # Ambil hasil dari database setelah semua kueri ter-filter
        results = query.order_by(MedicalRecord.created_at.desc()).all()

        filtered_data = []

        for record, patient in results:
            raw_name = safe_decrypt(patient.patient_name, fallback='Unknown')
            raw_nik = safe_decrypt(patient.national_id, fallback='-')
            raw_dob = safe_decrypt(patient.birth_date, fallback='')

            decrypted_name = str(raw_name) if raw_name else 'Unknown'
            decrypted_nik = str(raw_nik) if raw_nik else '-'

            _dob_searchable, dob_display = format_birth_date_for_search(raw_dob)

            searchable = " ".join([
                decrypted_name.lower(),
                decrypted_nik.lower(),
                record.record_number.lower()
            ])
            
            if search_query and search_query not in searchable:
                continue

            filtered_data.append({
                'rm_id': record.record_id,
                'record_number': record.record_number,
                'record_type': record.record_type,
                'patient_name': decrypted_name.title(),
                'nik': decrypted_nik,
                'birth_date': dob_display,
                'status': record.status,
                'created_at': format_date(record.created_at),
                'updated_at': format_date(record.last_update) if record.last_update else '-',
            })

        return jsonify(filtered_data), 200

    except Exception as e:
        return jsonify({'msg': 'Gagal memfilter data.', 'error': str(e)}), 500
    
# -----------------------------------------------------------------------------
# Update data
# -----------------------------------------------------------------------------
@medical_record_bp.route('/update-patient-data/<uuid>', methods=['PUT'])
@jwt_required()
def update_patient_and_family_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        data = request.get_json() or {}
        if not data:
            return jsonify({'msg': 'Payload data tidak boleh kosong.'}), 400

        record, patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        patient.patient_name = data.get('patient_name', patient.patient_name)
        patient.birth_date = parse_date(data.get('birthdate'))
        patient.national_id = data.get('nik', patient.national_id)
        patient.gender = data.get('gender', patient.gender)
        patient.patient_number = data.get('patient_number', patient.patient_number)
        patient.address = data.get('address', patient.address)
        patient.education_level = data.get('education', patient.education_level)
        patient.occupation = data.get('occupation', patient.occupation)
        patient.insurance_number = data.get('bpjs_number', patient.insurance_number)
        patient.primary_health_facility = data.get('primary_healthcare', patient.primary_health_facility)

        family_id = patient.family_link_id
        family = None

        if family_id:
            family_query = Patient.query.filter_by(patient_id=family_id)
            if current_role != 'admin':
                family_query = family_query.filter(Patient.clinic_id == current_user.clinic_id)
            family = family_query.first()

        if not family and data.get('family_name'):
            family = Patient(
                role='family',
                clinic_id=patient.clinic_id,
            )
            db.session.add(family)
            db.session.flush()

            patient.family_link_id = family.patient_id

        if family:
            family.patient_name = data.get('family_name', family.patient_name)
            family.birth_date = parse_date(data.get('family_birthdate'))
            family.national_id = data.get('family_nik', family.national_id)
            family.gender = data.get('family_gender', family.gender)
            family.relation = data.get('relation', family.relation)
            family.address = data.get('family_address', family.address)
            family.patient_number = data.get('family_number', family.patient_number)
            family.education_level = data.get('family_education', family.education_level)
            family.occupation = data.get('family_occupation', family.occupation)

        record.last_update = datetime.now()
        
        db.session.commit()

        return jsonify({
            'msg': 'Informasi rekam medis pasien dan keluarga berhasil diperbarui.',
            'patient_id': uuid,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Terjadi kesalahan pada server.', 'error': str(e)}), 500


@medical_record_bp.route('/update-pregnancy-record-data/<uuid>', methods=['PUT'])
@jwt_required()
def update_pregnancy_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        payload = request.get_json() or {}
        if not payload:
            return jsonify({'msg': 'Payload data tidak boleh kosong.'}), 400

        record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        current_preg_data = payload.get('current_pregnancy', {})
        past_history_data = payload.get('past_obstetric_history', [])

        pregnancy_record = PregnancyRecord.query.filter_by(record_id=uuid).first()
        if not pregnancy_record:
            return jsonify({'msg': 'Data rekam medis kehamilan tidak ditemukan.'}), 404

        pregnancy_record.contraceptive_history = current_preg_data.get(
            'contraceptive_history',
            pregnancy_record.contraceptive_history,
        )
        pregnancy_record.family_med_history = current_preg_data.get(
            'family_med_history',
            pregnancy_record.family_med_history,
        )
        pregnancy_record.lab_results = current_preg_data.get('lab_results', pregnancy_record.lab_results)
        pregnancy_record.diagnosis = current_preg_data.get('diagnosis', pregnancy_record.diagnosis)

        pregnancy_record.registration_date = parse_date(current_preg_data.get('registration_date'))
        pregnancy_record.tt_screening = current_preg_data.get('tt_screening', pregnancy_record.tt_screening)
        pregnancy_record.last_menstrual_period = parse_date(current_preg_data.get('last_menstrual_period'))
        pregnancy_record.expected_due_date = parse_date(current_preg_data.get('expected_due_date'))

        pregnancy_record.pre_preg_weight_kg = clean_float(current_preg_data.get('pre_preg_weight_kg'))
        pregnancy_record.pre_preg_muac_cm = clean_float(current_preg_data.get('pre_preg_muac_cm'))
        pregnancy_record.height_cm = clean_float(current_preg_data.get('height_cm'))
        pregnancy_record.weight_kg = clean_float(current_preg_data.get('weight_kg'))
        pregnancy_record.muac_cm = clean_float(current_preg_data.get('muac_cm'))

        ObstetricHistory.query.filter_by(pr_id=pregnancy_record.pr_id).delete()

        for index, item in enumerate(past_history_data):
            if not item.get('gestational_age') and not item.get('delivery_mode'):
                continue

            new_history = ObstetricHistory(
                pr_id=pregnancy_record.pr_id,
                pregnancy_no=item.get('pregnancy_no') or str(index + 1),
                gestational_age=item.get('gestational_age'),
                pregnancy_complications=item.get('pregnancy_complications'),
                delivery_mode=item.get('delivery_mode'),
                delivery_complications=item.get('delivery_complications'),
                postpartum_status=item.get('postpartum_status'),
                postpartum_complications=item.get('postpartum_complications'),
                baby_complications=item.get('baby_complications'),
                baby_weight=clean_float(item.get('baby_weight')),
                baby_height=clean_float(item.get('baby_height')),
            )
            db.session.add(new_history)
            
        record.last_update = datetime.now()
        
        db.session.commit()
        return jsonify({'msg': 'Berhasil diperbarui.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Terjadi kesalahan internal server.', 'error': str(e)}), 500


@medical_record_bp.route('/update-family-planning-record-data/<uuid>', methods=['PUT'])
@jwt_required()
def update_family_planning_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        payload = request.get_json() or {}
        if not payload:
            return jsonify({'msg': 'Payload data tidak boleh kosong.'}), 400

        record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        family_planning_record = FamilyPlanningRecord.query.filter_by(record_id=uuid).first()
        if not family_planning_record:
            return jsonify({'msg': 'Data rekam medis KB tidak ditemukan.'}), 404

        family_planning_record.number_of_children = clean_float(
            payload.get('number_of_children', family_planning_record.number_of_children),
        )
        family_planning_record.youngest_child_age = payload.get(
            'youngest_child_age',
            family_planning_record.youngest_child_age,
        )
        family_planning_record.family_med_history = payload.get(
            'family_med_history',
            family_planning_record.family_med_history,
        )
        record.last_update = datetime.now()
        db.session.commit()
        return jsonify({'msg': 'Berhasil diperbarui.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Terjadi kesalahan internal server.', 'error': str(e)}), 500


@medical_record_bp.route('/update-delivery-record-data/<uuid>', methods=['PUT'])
@jwt_required()
def update_delivery_record_data(uuid):
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        payload = request.get_json() or {}
        if not payload:
            return jsonify({'msg': 'Payload data tidak boleh kosong.'}), 400

        record, _patient, error_response = get_record_or_404(uuid, current_user, current_role)

        if error_response:
            return error_response

        delivery_record = DeliveryRecord.query.filter_by(record_id=uuid).first()
        if not delivery_record:
            return jsonify({'msg': 'Data rekam medis persalinan tidak ditemukan.'}), 404

        delivery_record.delivery_date = payload.get('delivery_date', delivery_record.delivery_date)
        delivery_record.delivery_type = payload.get('delivery_type', delivery_record.delivery_type)
        delivery_record.deliver_complications = payload.get(
            'deliver_complications',
            delivery_record.deliver_complications,
        )
        delivery_record.baby_gender = payload.get('baby_gender', delivery_record.baby_gender)
        delivery_record.vit_k_given = payload.get('vit_k_given', delivery_record.vit_k_given)
        delivery_record.baby_weight = clean_float(payload.get('baby_weight', delivery_record.baby_weight))
        delivery_record.hbo_given = payload.get('hbo_given', delivery_record.hbo_given)
        delivery_record.baby_length = clean_float(payload.get('baby_length', delivery_record.baby_length))
        delivery_record.apgar_score = payload.get('apgar_score', delivery_record.apgar_score)
        delivery_record.eye_ointment = payload.get('eye_ointment', delivery_record.eye_ointment)
        delivery_record.imd = payload.get('imd', delivery_record.imd)
        delivery_record.baby_complications = payload.get(
            'baby_complications',
            delivery_record.baby_complications,
        )
        record.last_update = datetime.now()
        db.session.commit()
        return jsonify({'msg': 'Berhasil diperbarui.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': 'Terjadi kesalahan internal server.', 'error': str(e)}), 500


@medical_record_bp.route("/json-delivery-record", methods=["GET"])
@jwt_required()
def get_json_visit_report():
    # 1. Pastikan require_clinic=True untuk menangkap data klinik Bidan yang sedang login
    current_user, current_role, error_response = require_medical_record_access(require_clinic=True)

    if error_response:
        return error_response

    try:
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        search_query = request.args.get("search", "").strip().lower()
        current_clinic_id = getattr(current_user, 'clinic_id', None) 

        query = db.session.query(MedicalRecord, Patient).join(
            Patient, MedicalRecord.patient_id == Patient.patient_id
        ).filter(
            MedicalRecord.record_type == "Persalinan"
        )

        if current_clinic_id:
            query = query.filter(MedicalRecord.clinic_id == current_clinic_id)

        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            query = query.filter(
                db.func.date(MedicalRecord.created_at) >= start_date,
                db.func.date(MedicalRecord.created_at) <= end_date
            )
        raw_records = query.order_by(MedicalRecord.created_at.desc()).all()
        results = []    

        for medical_record, patient in raw_records:
            decrypted_name = safe_decrypt(patient.patient_name)
            decrypted_nik = safe_decrypt(patient.national_id)
            decrypted_address = safe_decrypt(patient.address) if patient.address else "-"
            decrypted_phone = safe_decrypt(patient.patient_number) if patient.patient_number else "-"
            birth_date = format_date(patient.birth_date) if patient.birth_date else ""

            patient_age = "-"
            if patient.birth_date:
                today = date.today()
                
                calc_age = today.year - patient.birth_date.year
                calc_month = today.month - patient.birth_date.month
                if today.day < patient.birth_date.day:
                    calc_month -= 1
                if calc_month < 0:
                    calc_age -= 1
                    calc_month += 12
                patient_age = f"{calc_age} Tahun {calc_month} Bulan"

            decrypted_family_name = "-"
            family_age = "-"

            if patient.family_link_id:
                family = Patient.query.filter_by(patient_id=patient.family_link_id).first()
                if family:
                    decrypted_family_name = safe_decrypt(family.patient_name)
                    
                    if family.birth_date:
                        today = date.today()
                        calc_age = today.year - family.birth_date.year
                        calc_month = today.month - family.birth_date.month
                        if today.day < family.birth_date.day:
                            calc_month -= 1
                        if calc_month < 0:
                            calc_age -= 1
                            calc_month += 12
                        family_age = f"{calc_age} Tahun {calc_month} Bulan"

            searchable = " ".join([
                str(decrypted_name).lower(),
                str(decrypted_nik).lower(),
                str(medical_record.record_number).lower(),
            ])

            if search_query and search_query not in searchable:
                continue

            delivery_detail = DeliveryRecord.query.filter_by(record_id=medical_record.record_id).first()
            d_date = format_date(delivery_detail.delivery_date) if (delivery_detail and delivery_detail.delivery_date) else medical_record.created_at.strftime("%Y-%m-%d")

            row_data = {
                "record_id": str(medical_record.record_id),
                "record_number": medical_record.record_number,
                "created_at": medical_record.created_at.strftime("%Y-%m-%d %H:%M"),            
                "patient_id": str(patient.patient_id),
                "patient_name": str(decrypted_name).title() if decrypted_name else "Unknown",
                "national_id": decrypted_nik,
                "birth_date": birth_date,
                "patient_age": patient_age,
                "phone_number": decrypted_phone,
                "address": decrypted_address,
                "family_name": str(decrypted_family_name).title() if decrypted_family_name else "-",
                "family_age": family_age,
                
                "delivery_date": format_date(delivery_detail.delivery_date) if (delivery_detail and delivery_detail.delivery_date) else "-",
                "delivery_type": delivery_detail.delivery_type if delivery_detail else "-",
                "deliver_complications": safe_decrypt(delivery_detail.deliver_complications) if (delivery_detail and delivery_detail.deliver_complications) else "-",
                "baby_gender": delivery_detail.baby_gender if delivery_detail else "-",
                "baby_weight": delivery_detail.baby_weight if delivery_detail else 0,
                "baby_length": delivery_detail.baby_length if delivery_detail else 0,
                "apgar_score": delivery_detail.apgar_score if delivery_detail else "-",
                "baby_complications": safe_decrypt(delivery_detail.baby_complications) if (delivery_detail and delivery_detail.baby_complications) else "-",
            }

            results.append(row_data)

        return jsonify({"status": "success", "results": results}), 200

    except Exception as e:
        return jsonify({"msg": "Terjadi kesalahan pada server saat memuat data laporan persalinan.", "error": str(e)}), 500