from flask import Blueprint, request, jsonify
from app.models import db, Patient, MedicalRecord, PregnancyRecord, ObstetricHistory, FamilyPlanningRecord, GeneralRecord, DeliveryRecord
from app.utils import generate_record_number, get_latest_record_count 
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt

medical_record_bp = Blueprint('medical_record', __name__)

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

@medical_record_bp.route('/add-pregnancy', methods=['POST'])
@jwt_required()
def add_pregnancy_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # Validasi input
    patient_name = data.get('patient_name')
    birth_date = data.get('birth_date')
    national_id = data.get('national_id')
    
    
    if not patient_name or not birth_date or not national_id:
        return jsonify({"msg": "Nama, Tanggal Lahir, dan NIK wajib diisi!"}), 400
    
    try:
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
                patient_number=data.get('family_phone')
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
        
        
        new_pregnancy_record = PregnancyRecord(
            record_id=new_record.record_id,
            contraceptive_history=data.get('contraceptive_history'),
            family_med_history=data.get('family_med_history'),
            last_menstrual_period=data.get('last_menstrual_period'),
            expected_due_date=data.get('expected_due_date'),
            diagnosis=data.get('diagnosis'),
            registration_date = datetime.utcnow(),
            height_cm=data.get('height_cm'),
            weight_kg=data.get('weight_kg'),
            muac_cm=data.get('muac_cm'),
            tt_screening=data.get('tt_screening'),
            lab_results=data.get('lab_results'),
            pre_preg_weight_kg=data.get('pre_preg_weight_kg'),
            pre_preg_muac_cm=data.get('pre_preg_muac_cm'),

        );
        db.session.add(new_pregnancy_record)
        db.session.flush() 
        
        new_obstetric_history = ObstetricHistory(
            pr_id=new_pregnancy_record.pr_id,
            pregnancy_no=data.get('pregnancy_no'),
            gestational_age=data.get('gestational_age'),
            pregnancy_complications=data.get('pregnancy_complications'),
            delivery_mode=data.get('delivery_mode'),
            delivery_complications=data.get('delivery_complications'),
            baby_weight_height=data.get('baby_weight_height'),
            baby_complications=data.get('baby_complications'),
            postpartum_status=data.get('postpartum_status'),
            postpartum_complications=data.get('postpartum_complications')
        )
        db.session.add(new_obstetric_history)
        db.session.commit()
        
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": str(new_patient.patient_id),
            "rm_number": new_record.record_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to add medical record", "error": str(e)}), 500
    
@medical_record_bp.route('/add-family-planning', methods=['POST'])
@jwt_required()
def add_family_planning_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # Validasi input
    patient_name = data.get('patient_name')
    birth_date = data.get('birth_date')
    national_id = data.get('national_id')
    
    
    if not patient_name or not birth_date or not national_id:
        return jsonify({"msg": "Nama, Tanggal Lahir, dan NIK wajib diisi!"}), 400
    
    try:
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
                patient_number=data.get('family_phone'),
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
            number_of_children = data.get('number_of_children'),
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
        return jsonify({"msg": "Failed to add medical record", "error": str(e)}), 500

@medical_record_bp.route('/add-general', methods=['POST'])
@jwt_required()
def add_general_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # Validasi input
    patient_name = data.get('patient_name')
    birth_date = data.get('birth_date')
    national_id = data.get('national_id')
    
    
    if not patient_name or not birth_date or not national_id:
        return jsonify({"msg": "Nama, Tanggal Lahir, dan NIK wajib diisi!"}), 400
    
    try:
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
                patient_number=data.get('family_phone'),
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
        return jsonify({"msg": "Failed to add medical record", "error": str(e)}), 500

@medical_record_bp.route('/add-delivery', methods=['POST'])
@jwt_required()
def add_delivery_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")
    current_family_link_id = claims.get("family_link_id")
    
    
    data = request.get_json()
    
    # Validasi input
    patient_name = data.get('patient_name')
    birth_date = data.get('birth_date')
    national_id = data.get('national_id')
    
    
    if not patient_name or not birth_date or not national_id:
        return jsonify({"msg": "Nama, Tanggal Lahir, dan NIK wajib diisi!"}), 400
    
    try:
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
                patient_number=data.get('family_phone'),
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
        
         # Add family planning record
        new_delivery_record = DeliveryRecord(
            record_id=new_record.record_id,
            delivery_date = data.get('delivery_date'),
            delivery_type = data.get('delivery_type'),
            deliver_complications = data.get('deliver_complications'),
            baby_gender = data.get('baby_gender'),
            baby_weight = data.get('baby_weight'),
            baby_length = data.get('baby_length'),
            apgar_score = data.get('apgar_score'),
            baby_complications = data.get('baby_complications'),
            vit_k_given = data.get('vit_k_given'),
            hbo_given = data.get('hbo_given')
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
        return jsonify({"msg": "Failed to add medical record", "error": str(e)}), 500

