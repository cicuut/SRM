from flask import Blueprint, request, jsonify
from app.models import db, Patient, MedicalRecord
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

@medical_record_bp.route('/add', methods=['POST'])
@jwt_required()
def add_medical_record():
    claims = get_jwt()
    current_clinic_id = claims.get("clinic_id")

    data = request.get_json()
    
    patient_name = data.get('patient_name')
    birth_date = data.get('birth_date') 
    gender = data.get('gender')
    
    # Validasi input
    if not patient_name or not birth_date or not gender:
        return jsonify({"msg": "Patient name, birth date, and gender are required"}), 400
    
    try:
        # Add new patient
        new_patient = Patient(
            patient_name=patient_name,
            clinic_id=current_clinic_id,
            birth_date=datetime.strptime(birth_date, '%Y-%m-%d').date(), 
            national_id=data.get('national_id'),
            address=data.get('address'),
            patient_number=data.get('patient_number'),
            gender=gender,
            education_level=data.get('education_level'), 
            occupation=data.get('occupation'),
            insurance_number=data.get('insurance_number'),
            primary_health_facility=data.get('primary_health_facility')
        )
        db.session.add(new_patient)
        db.session.flush() 
        
        record_type = data.get('record_type')
        count = get_latest_record_count(record_type)
        rm_number = generate_record_number(record_type, count)
        
        # 2. Create medical record
        new_record = MedicalRecord(
            patient_id=new_patient.patient_id,
            record_number=rm_number,
            record_type=record_type,
            status='Active',
            created_at=datetime.utcnow() 
        )
        
        db.session.add(new_record)
        db.session.commit()
        
        return jsonify({
            "msg": "Medical record added successfully", 
            "patient_id": str(new_patient.patient_id),
            "rm_number": rm_number
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to add medical record", "error": str(e)}), 500