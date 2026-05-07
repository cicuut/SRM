from flask import Blueprint, request, jsonify
from app.models import db, Patient, MedicalRecord, PregnancyRecord, ObstetricHistory, FamilyPlanningRecord, GeneralRecord, DeliveryRecord, ImmunizationRecord, VisitImunization, VisitMaster, VisitFamilyPlanning, VisitPregnancy, VisitGeneral
from app.utils import generate_record_number, get_latest_record_count, decrypt_data, clean_float, format_date
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import or_

medical_record_bp = Blueprint('medical_record', __name__)

# Get Medical Record Number
@medical_record_bp.route('/rm-number', methods=['GET'])
@jwt_required() 
def get_next_number():
    record_type = request.args.get('type')
    
    if not record_type:
        return jsonify({"msg": "Medical Record Type is required"}), 400

    try:
        count = get_latest_record_count(record_type)
        next_rm_number = generate_record_number(record_type, count)
        
        return jsonify({
            "record_type": record_type,
            "next_rm_number": next_rm_number
        }), 200
        
    except Exception as e:
        return jsonify({"msg": "Failed to generate number", "error": str(e)}), 500
    
# Add Pregnancy Record  
@medical_record_bp.route('/add-pregnancy', methods=['POST'])
@jwt_required()
def add_pregnancy_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # required input validation
    required_fields = ['family_name', 'family_birth_date', 'family_national_id', 'family_gender', 'family_address', 'family_number', 'relation',
                       'patient_name', 'birth_date', 'national_id', 'gender', 'patient_number', 'address']

    for field in required_fields:
        if not data.get(field):
            return jsonify({"msg": "Tanda * wajib untuk diisi!"}), 400
    
    try:
        # Add family
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
            
        # Add new patient
        new_patient = Patient(
            patient_name=data.get('patient_name'),
            birth_date=data.get('birth_date'),
            national_id=data.get('national_id'),
            gender=data.get('gender'),
            clinic_id=current_clinic_id,
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
        
        # 2. Create medical record
        new_record = MedicalRecord(
            patient_id=new_patient.patient_id,
            record_number=data.get('record_number'),
            record_type='Kehamilan',
            status='Active',
            created_at=datetime.utcnow() 
        )
        
        db.session.add(new_record)
        db.session.flush() 
        
        # Crete new pregnancy medical record
        new_pregnancy_record = PregnancyRecord(
            record_id=new_record.record_id,
            contraceptive_history=data.get('contraceptive_history'),
            family_med_history=data.get('family_med_history'),
            last_menstrual_period=data.get('last_menstrual_period'),
            expected_due_date=data.get('expected_due_date'),
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
        
        # Add data in obstectric_history table
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
                postpartum_complications=obs.get('postpartum_complications')
            )
            db.session.add(new_history)
        db.session.commit()
        
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": new_patient.patient_id,
            "rm_number": new_record.record_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500

# Add Medical Record Family Planning
@medical_record_bp.route('/add-family-planning', methods=['POST'])
@jwt_required()
def add_family_planning_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # Validasi input
    required_fields = ['family_name', 'family_birth_date', 'family_national_id', 'family_gender', 'family_address', 'family_number', 'relation',
                       'patient_name', 'birth_date', 'national_id', 'gender', 'patient_number', 'address']

    for field in required_fields:
        if not data.get(field):
            return jsonify({"msg": "Tanda * wajib untuk diisi!"}), 400
    
    
    try:
        #Add family
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
                occupation=data.get('family_occupation')
            )
            db.session.add(new_family)
            db.session.flush()
            family_id = new_family.patient_id
            
        # Add new patient
        new_patient = Patient(
            patient_name=data.get('patient_name'),
            birth_date=data.get('birth_date'),
            national_id=data.get('national_id'),
            gender=data.get('gender'),
            clinic_id=current_clinic_id,
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
        
        # Add medical record
        new_record = MedicalRecord(
            patient_id=new_patient.patient_id,
            record_number=data.get('record_number'),
            record_type='Keluarga Berencana',
            status='Active',
            created_at=datetime.utcnow() 
        )
        
        db.session.add(new_record)
        db.session.flush() 
        
        # Add family planning record
        new_family_planning_record = FamilyPlanningRecord(
            record_id=new_record.record_id,
            number_of_children = clean_float(data.get('number_of_children')),
            youngest_child_age = data.get('youngest_child_age'),
            family_med_history=data.get('family_med_history'),
        )
        
        db.session.add(  new_family_planning_record)
        db.session.commit()
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": str(new_patient.patient_id),
            "rm_number": new_record.record_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500

# Add general medical record
@medical_record_bp.route('/add-general', methods=['POST'])
@jwt_required()
def add_general_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    required_fields = ['family_name', 'family_birth_date', 'family_national_id', 'family_gender', 'family_address', 'family_number', 'relation',
                       'patient_name', 'birth_date', 'national_id', 'gender', 'patient_number', 'address']

    for field in required_fields:
        if not data.get(field):
            return jsonify({"msg": "Tanda * wajib untuk diisi!"}), 400
    
    try:
        # Add family profile
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
                occupation=data.get('family_occupation')
            )
            db.session.add(new_family)
            db.session.flush()
            family_id = new_family.patient_id
            
        # Add new patient
        new_patient = Patient(
            patient_name=data.get('patient_name'),
            birth_date=data.get('birth_date'),
            national_id=data.get('national_id'),
            gender=data.get('gender'),
            clinic_id=current_clinic_id,
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
        
        # Add medical record
        new_record = MedicalRecord(
            patient_id=new_patient.patient_id,
            record_number=data.get('record_number'),
            record_type='Umum',
            status='Active',
            created_at=datetime.utcnow() 
        )
        
        db.session.add(new_record)
        db.session.flush() 
        db.session.commit()
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": str(new_patient.patient_id),
            "rm_number": new_record.record_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500
    
# Add immunization Record
@medical_record_bp.route('/add-immunization', methods=['POST'])
@jwt_required()
def add_immunization_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    data = request.get_json()
    
    required_fields = ['family_name', 'family_birth_date', 'family_national_id', 'family_gender', 'family_address', 'family_number', 'relation',
                       'patient_name', 'birth_date', 'national_id', 'gender', 'patient_number', 'address']

    for field in required_fields:
        if not data.get(field):
            return jsonify({"msg": "Tanda * wajib untuk diisi!"}), 400
    
    try:
        # Add family profile
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
                occupation=data.get('family_occupation')
            )
            db.session.add(new_family)
            db.session.flush()
            family_id = new_family.patient_id
            
        # Add new patient
        new_patient = Patient(
            patient_name=data.get('patient_name'),
            birth_date=data.get('birth_date'),
            national_id=data.get('national_id'),
            gender=data.get('gender'),
            clinic_id=current_clinic_id,
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
        
        # Add medical record
        new_record = MedicalRecord(
            patient_id=new_patient.patient_id,
            record_number=data.get('record_number'),
            record_type='Imunisasi',
            status='Active',
            created_at=datetime.utcnow() 
        )
        
        db.session.add(new_record)
        db.session.flush() 
        
        # Add Immunization Record
        new_immunization_record = ImmunizationRecord(
            record_id=new_record.record_id,
          
        )
        db.session.add(new_immunization_record)
        db.session.flush() 
        db.session.commit()
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": str(new_patient.patient_id),
            "rm_number": new_record.record_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal menambahkan rekam medis", "error": str(e)}), 500


# Add delivery record
@medical_record_bp.route('/add-delivery', methods=['POST'])
@jwt_required()
def add_delivery_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # Validasi input
    required_fields = ['family_name', 'family_birth_date', 'family_national_id', 'family_gender', 'family_address', 'family_number', 'relation',
                       'patient_name', 'birth_date', 'national_id', 'gender', 'patient_number', 'address']

    for field in required_fields:
        if not data.get(field):
            return jsonify({"msg": "Tanda * wajib untuk diisi!"}), 400
    
    try:
        #Add family profile
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
                occupation=data.get('family_occupation')
            )
            db.session.add(new_family)
            db.session.flush()
            family_id = new_family.patient_id
            
        # Add new patient
        new_patient = Patient(
            patient_name=data.get('patient_name'),
            birth_date=data.get('birth_date'),
            national_id=data.get('national_id'),
            gender=data.get('gender'),
            clinic_id=current_clinic_id,
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
        
        # Add medical record
        new_record = MedicalRecord(
            patient_id=new_patient.patient_id,
            record_number=data.get('record_number'),
            record_type='Persalinan',
            status='Active',
            created_at=datetime.utcnow() 
        )
        
        db.session.add(new_record)
        db.session.flush() 
        
         # Add Delivery record
        new_delivery_record = DeliveryRecord(
            record_id=new_record.record_id,
            delivery_date = format_date(data.get('delivery_date')),
            delivery_type = data.get('delivery_type'),
            deliver_complications = data.get('deliver_complications'),
            baby_gender = data.get('baby_gender'),
            baby_weight = clean_float(data.get('baby_weight')),
            baby_length = clean_float(data.get('baby_lenght')),
            apgar_score = data.get('apgar_score'),
            baby_complications = data.get('baby_complications') ,
            vit_k_given = data.get('vit_k_given'),
            hbo_given = data.get('hbo_given'),
            eye_ointment = data.get('eye_ointment'),
            imd = data.get('imd')
        )
        
        db.session.add(new_delivery_record)
        db.session.commit()
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": str(new_patient.patient_id),
            "rm_number": new_record.record_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Gagal Menambahkan Rekam Medis", "error": str(e)}), 500
    
# Get All Record table in medical record page
@medical_record_bp.route('/get-all-records', methods=['GET'])
@jwt_required()
def get_all_records():
    try:
        results = db.session.query(MedicalRecord, Patient).\
            join(Patient, MedicalRecord.patient_id == Patient.patient_id).\
            all()

        record_list = []
        for record, patient in results:
            decrypted_name = decrypt_data(patient.patient_name)
            decrypted_nik = decrypt_data(patient.national_id)

            record_list.append({
                "rm_id": record.record_id,
                "record_number": record.record_number,
                "record_type": record.record_type,
                "patient_name": decrypted_name,
                "nik": decrypted_nik,
                "birth_date": format_date(patient.birth_date),
                "status": record.status,
                "created_at": format_date(record.created_at),
                "updated_at": format_date(record.last_update) if record.last_update else "-"
            })

        return jsonify(record_list), 200
    except Exception as e:
        return jsonify({"msg": "Gagal mengambil data", "error": str(e)}), 500
    
# Route to get record type
@medical_record_bp.route('/get-record/<uuid>', methods=['GET'])
@jwt_required()
def get_record_detail(uuid):
    try:
        #search record
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Data tidak ditemukan"}), 404

        #search patient
        patient = Patient.query.get(record.patient_id)        
     
        response_data = {
            "record_number": record.record_number,
            "record_type": record.record_type,
            "patient_name": decrypt_data(patient.patient_name),
            "created_at": format_date(record.created_at),
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    
# get patient data for spesific medical record
@medical_record_bp.route('/get-patient-data/<uuid>', methods=['GET'])
@jwt_required()
def get_patient_data(uuid):
    try:
        #search record
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Data tidak ditemukan"}), 404

        #search patient
        patient = Patient.query.get(record.patient_id)
        patient_age = patient.age # function to calculate patient age
       
        response_data = {
           "patient_name":decrypt_data(patient.patient_name),
           "nik": decrypt_data(patient.national_id),
           "birthdate": format_date(patient.birth_date),
           "patient_number": decrypt_data(patient.patient_number),
           "gender":patient.gender,
           "age": patient.age,
           "type":record.record_type,
           "address": decrypt_data(patient.address),
           "education": patient.education_level or "-",
           "occupation": patient.occupation or "-",
           "bpjs_number": decrypt_data(patient.insurance_number) or "-",
           "primary_healthcare": patient.primary_health_facility or "-"
        }
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

# get family data for spesific medical record
@medical_record_bp.route('/get-family-data/<uuid>', methods=['GET'])
@jwt_required()
def get_family_data(uuid):
    try:
        #search record
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404
        
        #find the patient_id to get family profile
        current_patient = Patient.query.get(record.patient_id)
        if not current_patient:
            return jsonify({"msg": "Pasien tidak ditemukan"}), 404

        family_person = None

        if current_patient.role == 'self':
            family_person = Patient.query.get(current_patient.family_link_id)
      
    
        if not family_person:
            return jsonify({
                "msg": "Data Keluarga tidak ditemukan", 
                "data": None
            }), 200
   
        response_data = {
            "patient_name": decrypt_data(family_person.patient_name),
            "nik": decrypt_data(family_person.national_id),
            "birthdate": format_date(family_person.birth_date),
            "gender": family_person.gender,
            "age": family_person.age,
            "relation": family_person.relation, 
            "patient_number": decrypt_data(family_person.patient_number),
            "occupation": family_person.occupation or "-",
            "education": family_person.education_level or "-",
            "address": decrypt_data(family_person.address)  or "-"
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    
# get pregnancy medical record detail
@medical_record_bp.route('/get-pregnancy-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_pregnancy_record_data(uuid):
    try:
        # Get medical record
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        # Get pregnancy record
        current_pregnancy_record = PregnancyRecord.query.filter_by(record_id=uuid).first()
        if not current_pregnancy_record:
            return jsonify({"msg": "Data kehamilan tidak ditemukan"}), 404
        
        #get obsetctric_history (
        current_obstectric_history = ObstetricHistory.query.filter_by(pr_id=current_pregnancy_record.pr_id).all()
        
        #array obsetctric_history
        obstectric_history_list = []
        for obs in current_obstectric_history:
            obstectric_history_list.append({
                "id": obs.history_id,
                "pregnancy_no": obs.pregnancy_no or "-",
                "gestational_age": obs.gestational_age or "-",
                "pregnancy_complications": decrypt_data(obs.pregnancy_complications) or "-",
                "delivery_mode": obs.delivery_mode or "-",
                "delivery_complications": decrypt_data(obs.delivery_complications) or "-",
                "baby_weight": obs.baby_weight or "-",
                "baby_height": obs.baby_height or "-",
                "baby_complications": decrypt_data(obs.baby_complications) or "-",
                "postpartum_status": decrypt_data(obs.postpartum_status) or "-",
                "postpartum_complications": decrypt_data(obs.postpartum_complications) or "-"
            })
        
        # pregnancy record respones
        response_data = {
            "current_pregnancy": {
                "contraceptive_history": decrypt_data(current_pregnancy_record.contraceptive_history) or "-",
                "family_med_history":  decrypt_data(current_pregnancy_record.family_med_history) or "-",
                "last_menstrual_period": format_date(current_pregnancy_record.last_menstrual_period), 
                "expected_due_date": format_date(current_pregnancy_record.expected_due_date), 
                "diagnosis":  decrypt_data(current_pregnancy_record.diagnosis) or "-",
                "height_cm": current_pregnancy_record.height_cm or "-",
                "weight_kg": current_pregnancy_record.weight_kg or "-",
                "muac_cm": current_pregnancy_record.muac_cm or "-",
                "pre_preg_weight_kg": current_pregnancy_record.pre_preg_weight_kg or "-",
                "pre_preg_muac_cm": current_pregnancy_record.pre_preg_muac_cm or "-",
                "tt_screening": current_pregnancy_record.tt_screening or "-",
                "lab_results": decrypt_data(current_pregnancy_record.lab_results) or "-",
                "registration_date": format_date(current_pregnancy_record.registration_date) 
            },
            "past_obstetric_history": obstectric_history_list
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

# get visit report pregnancy detailed (medical record) 
@medical_record_bp.route('/get-pregnancy-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_pregnancy_visit_data(uuid):
    try:
        results = db.session.query(VisitMaster, VisitPregnancy).\
            join(VisitPregnancy, VisitMaster.visit_id == VisitPregnancy.visit_id).\
            filter(VisitMaster.record_id == uuid).\
            order_by(VisitMaster.visit_date.desc()).all()

        if not results:
            return jsonify([]), 200

        visit_list = []
        for master, detail in results:
            visit_list.append({
                "visit_id": master.visit_id,
                "visit_date": format_date(master.visit_date) or "-",
                "visit_time": master.visit_time.strftime('%H:%M') or "-",
                "weight": detail.weight_kg or "-",
                "height": detail.height_cm or "-",
                "blood_pressure": detail.blood_pressure or "-",
                "body_temperature": detail.body_temperature or "-",
                "respiratory_rate": detail.respiratory_rate or "-",
                "heart_rate": detail.heart_rate or "-",
                "subjective": detail.subjective or "-",
                "objective": detail.objective or "-",
                "assessment": detail.assessment or "-",
                "plan": detail.plan or "-",
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    
# Get Family Planning Medical Record Detailed
@medical_record_bp.route('/get-family-planning-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_family_planning_record_data(uuid):
    try:
        # Get medical record
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        # Get Family Planning Medical Record
        current_family_planning_record = FamilyPlanningRecord.query.filter_by(record_id=uuid).first()
        if not  current_family_planning_record:
            return jsonify({"msg": "Rekam medis KB tidak ditemukan"}), 404
        

        response_data = {
            "number_of_children": clean_float(current_family_planning_record.number_of_children) or "-",
            "family_med_history": decrypt_data(current_family_planning_record.family_med_history) or "-",
            "youngest_child_age": current_family_planning_record.youngest_child_age or "-"
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    

# get family planing visit detailed (medical record)
@medical_record_bp.route('/get-family-planning-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_family_planning_visit_data(uuid):
    try:
        results = db.session.query(VisitMaster, VisitFamilyPlanning).\
            join(VisitFamilyPlanning, VisitMaster.visit_id == VisitFamilyPlanning.visit_id).\
            filter(VisitMaster.record_id == uuid).\
            order_by(VisitMaster.visit_date.desc()).all()

        if not results:
            return jsonify([]), 200

        visit_list = []
        for master, detail in results:
            visit_list.append({
                "visit_id": master.visit_id,
                "visit_date": format_date(master.visit_date),
                "visit_time": master.visit_time.strftime('%H:%M'),
                "weight": detail.weight_kg  or "-",
                "blood_pressure": detail.blood_pressure  or "-",
                "contraceptive_method": detail.kb_method,
                "follow_up_visit": format_date(detail.return_visit_date) if detail.return_visit_date else "-",
                "complaints": detail.complaint or "-"
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

    
# get delivery record detailed
@medical_record_bp.route('/get-delivery-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_delivery_record_data(uuid):
    try:
        # 1. Cari Rekam Medisnya dulu
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        current_delivery_record = DeliveryRecord.query.filter_by(record_id=uuid).first()
        if not  current_delivery_record:
            return jsonify({"msg": "Data Persalinan tidak ditemukan"}), 404
        

        response_data = {
            "delivery_date": format_date(current_delivery_record.delivery_date)  or "-",
            "delivery_type": current_delivery_record.delivery_type  or "-", 
            "deliver_complications": decrypt_data(current_delivery_record.deliver_complications)  or "-",
            "baby_gender": current_delivery_record.baby_gender  or "-",
            "apgar_score": current_delivery_record.apgar_score  or "-",
            "baby_complications": decrypt_data(current_delivery_record.baby_complications)  or "-",
            "vit_k_given":current_delivery_record.vit_k_given,
            "hbo_given": current_delivery_record.hbo_given,
            "eye_ointment": current_delivery_record.eye_ointment,
            "imd": current_delivery_record.imd,
            "baby_length": current_delivery_record.baby_length  or "-",
            "baby_weight": current_delivery_record.baby_weight  or "-"
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

   
# get vaccine tracking 
@medical_record_bp.route('/get-immunization-record-data/<uuid>', methods=['GET'])
@jwt_required()
def get_immunization_record_data(uuid):
    try:
        # get medical record
        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Rekam medis tidak ditemukan"}), 404

        #get immunization record
        current_immunization_record = ImmunizationRecord.query.filter_by(record_id=uuid).first()
        if not  current_immunization_record:
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
            "rotavirus_3": format_date(current_immunization_record.rotavirus_3)
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    

# get immunization visit
@medical_record_bp.route('/get-immunization-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_immunization_visit_data(uuid):
    try:
        results = db.session.query(VisitMaster, VisitImunization).\
            join(VisitImunization, VisitMaster.visit_id == VisitImunization.visit_id).\
            filter(VisitMaster.record_id == uuid).\
            order_by(VisitMaster.visit_date.desc()).all()

        if not results:
            return jsonify([]), 200

        visit_list = []
        for master, detail in results:
            visit_list.append({
                "visit_id": master.visit_id,
                "visit_date": format_date(master.visit_date),
                "visit_time": master.visit_time.strftime('%H:%M'),
                "height": detail.baby_weight or "-",
                "weight": detail.baby_weight or "-",
                "body_temperature": detail.body_temp or "-",
                "head_circumference": detail.head_circumference or "-",
                "abdominal_circumference": detail.abdominal_circumference or "-",
                "vaccine": detail.vaccine_given or "-", 
                "dosage": detail.dosage_given or "-"
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

# get general visit detailed (medical record)
@medical_record_bp.route('/get-general-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_general_visit_data(uuid):
    try:
        results = db.session.query(VisitMaster, VisitGeneral).\
            join(VisitGeneral, VisitMaster.visit_id == VisitGeneral.visit_id).\
            filter(VisitMaster.record_id == uuid).\
            order_by(VisitMaster.visit_date.desc()).all()

        if not results:
            return jsonify([]), 200

        visit_list = []
        for master, detail in results:
            visit_list.append({
                "visit_id": master.visit_id,
                "visit_date": format_date(master.visit_date),
                "visit_time": master.visit_time.strftime('%H:%M'),
                "subjective": detail.subjective or "-",
                "objective": detail.objective or "-",
                "assessment": detail.assessment or "-",
                "plan": detail.plan or "-",
            })

        return jsonify(visit_list), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

# search medical record
@medical_record_bp.route('/search-patients', methods=['GET'])
@jwt_required()
def search_patients():
    try:
        search_query = request.args.get('query', '').lower()
        
        results = db.session.query(MedicalRecord, Patient)\
            .join(Patient, MedicalRecord.patient_id == Patient.patient_id)\
            .all()

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
    