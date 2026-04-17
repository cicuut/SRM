from flask import Blueprint, request, jsonify
from app.models import db, Patient, MedicalRecord, VisitMaster, VisitPregnancy
from app.utils import generate_visit_number, get_latest_visits_count, decrypt_data
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import or_


visit_report_bp = Blueprint('visit_report', __name__)


@visit_report_bp.route('/visit-number', methods=['GET'])
@jwt_required() 
def get_visit_number():

    try:
        record_id = request.args.get('record_id')

        if not record_id:
            return jsonify({"msg": "record_id is required"}), 400
        
        count = get_latest_visits_count(record_id)
        next_visit_number = generate_visit_number(count)

        return jsonify({
            "visit_number": next_visit_number
        }), 200
        
    except Exception as e:
        return jsonify({"msg": "Failed to generate number", "error": str(e)}), 500
    
@visit_report_bp.route('/get-visit-information', methods=['GET'])
@jwt_required()
def get_visit_information():
    uuid = request.args.get('uuid')
    
    try:
        if not uuid:
            return jsonify({"msg": "uuid is required"}), 400

        record = MedicalRecord.query.filter_by(record_id=uuid).first()
        if not record:
            return jsonify({"msg": "Record tidak ditemukan"}), 404

        patient = Patient.query.get(record.patient_id)


        response_data = {
            "patient_name": decrypt_data(patient.patient_name),
            "record_number": record.record_number,
            "record_type": record.record_type,
            "visit_date": datetime.now().strftime("%Y-%m-%d"),
            "visit_time": datetime.now().strftime("%H:%M:%S")
        }
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    

@visit_report_bp.route('/add-visit-pregnancy', methods=['POST'])
@jwt_required()
def add_visit_pregnancy():
    claims = get_jwt()
    data = request.get_json()
 
    try:
       #Add visit master
        new_visit = VisitMaster(
            record_id=data.get('record_id'),
            visit_number=data.get('visit_number'),
            visit_date=datetime.utcnow(),
            visit_time=datetime.utcnow()
        )
        db.session.add(new_visit)
        db.session.flush() 
        
        # 2. Add Visit Pregnancy
        new_pregnancy_visit = VisitPregnancy(
            visit_id=new_visit.visit_id,
            blood_pressure=data.get('blood_pressure'),
            weight_kg=data.get('weight_kg'),
            height_cm=data.get('height_cm'),
            body_temperature=data.get('body_temperature'),
            respiratory_rate=data.get('respiratory_rate'),
            heart_rate=data.get('heart_rate'),
            subjective=data.get('subjective'),
            objective=data.get('objective'),
            assessment=data.get('assessment'),
            plan=data.get('plan')
        )
        
        db.session.add(new_pregnancy_visit)
        db.session.flush() 
        db.session.commit()
        
        
        return jsonify({
            "msg": "Visit added successfully", 
            "rm_number": new_visit.record_id,
            "visit_id": new_visit.visit_id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to add visit", "error": str(e)}), 500