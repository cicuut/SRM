from flask import Blueprint, request, jsonify
from app.models import PregnancyRecord, User, db, Patient, MedicalRecord, VisitMaster, VisitPregnancy
from app.utils import generate_visit_number, get_latest_visits_count, decrypt_data
from datetime import datetime
from flask_jwt_extended import get_jwt_identity, jwt_required, get_jwt
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
    

    
@visit_report_bp.route('/get-all-visit', methods=['GET'])
@jwt_required()
def get_all_records():
    try:
        results = db.session.query(VisitMaster, MedicalRecord, Patient, User).\
            join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id).\
            join(Patient, MedicalRecord.patient_id == Patient.patient_id).\
            join(User, VisitMaster.user_id == User.user_id).\
            all()

        record_list = []
        for visit, medical_record, patient, user in results:
            decrypted_name = decrypt_data(patient.patient_name)
            decrypted_nik = decrypt_data(patient.national_id)

            record_list.append({
                "visit_id": visit.visit_id,
                "visit_date": visit.visit_date,
                "visit_number": visit.visit_number,
                "rm_number": medical_record.record_number,
                "patient_name": decrypted_name,
                "nik": decrypted_nik,
                "record_type": medical_record.record_type,
                "made_by": user.fullname
            })

        return jsonify(record_list), 200
    except Exception as e:
        return jsonify({"msg": "Gagal mengambil data", "error": str(e)}), 500
    
@visit_report_bp.route('/get-visit-report/<uuid>', methods=['GET'])
@jwt_required()
def get_visit_detail(uuid):
    try:
      
        record = VisitMaster.query.filter_by(visit_id=uuid).first()
        if not record:
            return jsonify({"msg": "Data tidak ditemukan"}), 404
        
        medical_record = MedicalRecord.query.get(record.record_id)
        response_data = {
            "visit_id": record.visit_id,
            "visit_number": record.visit_number,
            "visit_type": medical_record.record_type,
        }
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500
    

@visit_report_bp.route('/get-visit-data/<uuid>', methods=['GET'])
@jwt_required()
def get_patient_data(uuid):
    try:
        result = db.session.query(VisitMaster, MedicalRecord, Patient, User).\
            join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id).\
            join(Patient, MedicalRecord.patient_id == Patient.patient_id).\
            join(User, VisitMaster.user_id == User.user_id).\
            filter(VisitMaster.visit_id == uuid).\
            first()
        
        if not result:
            return jsonify({"msg": "Data kunjungan tidak ditemukan"}), 404
        
        visit, medical_record, patient, user = result
        decrypted_name = decrypt_data(patient.patient_name)
        decrypted_nik = decrypt_data(patient.national_id)

        return jsonify({
            "visit_id": visit.visit_id,
            "visit_date": visit.visit_date.strftime('%Y-%m-%d') if visit.visit_date else None,
            "visit_time": visit.visit_time.strftime('%H:%M') if visit.visit_time else None,
            "visit_number": visit.visit_number,
            "rm_number": medical_record.record_number,
            "patient_name": decrypted_name,
            "nik": decrypted_nik,
            "record_type": medical_record.record_type,
            "made_by": user.fullname,
        }), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

@visit_report_bp.route('/add-visit-pregnancy', methods=['POST'])
@jwt_required()
def add_visit_pregnancy():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    try:
       #Add visit master
        new_visit = VisitMaster(
            record_id=data.get('record_id'),
            user_id=user_id,
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

@visit_report_bp.route('/get-visit-pregnancy/<uuid>', methods=['GET'])
@jwt_required()
def get_pregnancy_visit(uuid):
    try:
        visit_report=VisitMaster.query.filter_by(visit_id=uuid).first()
        if not visit_report:
            return jsonify({"msg": "Data kunjungan tidak ditemukan"}), 404

        current_pregnancy_visit = VisitPregnancy.query.filter_by(visit_id=uuid).first()
        if not  current_pregnancy_visit:
            return jsonify({"msg": "Data Kehamilan tidak ditemukan"}), 404
        

        decrypted_subjective = decrypt_data(current_pregnancy_visit.subjective)
        decrypted_objective = decrypt_data(current_pregnancy_visit.objective)
        decrypted_assessment = decrypt_data(current_pregnancy_visit.assessment)
        decrypted_plan = decrypt_data(current_pregnancy_visit.plan)

        return jsonify({
          "subjective": decrypted_subjective,
          "objective": decrypted_objective, 
          "assessment": decrypted_assessment,
          "plan": decrypted_plan
        }), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500