from flask import Blueprint, request, jsonify
from app.models import PregnancyRecord, User, db, Patient, MedicalRecord, VisitMaster, VisitPregnancy, VisitFamilyPlanning, ImmunizationRecord, VisitImunization, GeneralRecord, VisitGeneral, FamilyPlanningRecord, Financial
from app.utils import generate_visit_number, get_next_visit_sequence_and_increment, decrypt_data, get_column_name, clean_float, format_date, generate_financial_number, reserve_next_sequence
from datetime import datetime
from flask_jwt_extended import get_jwt_identity, jwt_required, get_jwt
from sqlalchemy import or_, text
import pytz

visit_report_bp = Blueprint('visit_report', __name__)


@visit_report_bp.route('/visit-number', methods=['GET'])
@jwt_required() 
def get_visit_number():

    try:
        count = get_next_visit_sequence_and_increment()
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
        tz_jakarta = pytz.timezone('Asia/Jakarta')
        now_jakarta = datetime.now(tz_jakarta)

        response_data = {
            "patient_name": decrypt_data(patient.patient_name),
            "record_number": record.record_number,
            "record_type": record.record_type,
            "visit_date": format_date(now_jakarta.date()),
            "visit_time": now_jakarta.strftime('%H:%M')         
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
            join(User, VisitMaster.user_id == User.user_id)\
            .order_by(VisitMaster.visit_date.desc(), VisitMaster.visit_time.desc()).\
            all()

        record_list = []
        for visit, medical_record, patient, user in results:
            decrypted_name = decrypt_data(patient.patient_name)
            decrypted_nik = decrypt_data(patient.national_id)

            record_list.append({
                "visit_id": visit.visit_id,
                "visit_date": f"{format_date(visit.visit_date)} {visit.visit_time.strftime('%H:%M')}",
                "visit_number": visit.visit_number,
                "record_number": medical_record.record_number,
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
            "visit_date": f"{format_date(visit.visit_date)} {visit.visit_time.strftime('%H:%M')}",
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
    claims = get_jwt()
    record_id = data.get('record_id')
    jakarta_tz = pytz.timezone('Asia/Jakarta')
    now_jakarta = datetime.now(jakarta_tz)
    current_year = now_jakarta.year
    pregnancy_record = PregnancyRecord.query.filter_by(record_id=record_id).first()
    clinic_id = claims.get("clinic_id")

    medical_record = MedicalRecord.query.get(record_id)
    if not medical_record:
        return jsonify({"msg": "Data rekam medis tidak ditemukan"}), 404
    
    try:
        patient = Patient.query.get(medical_record.patient_id)
        patient_name = patient.patient_name if patient else "Pasien"
       #Add visit master
        new_visit = VisitMaster(
            record_id=record_id,
            user_id=user_id,
            visit_number=data.get('visit_number'),
            visit_date= now_jakarta,
            visit_time= now_jakarta
        )
        db.session.add(new_visit)
        db.session.flush() 
        
        # 2. Add Visit Pregnancy
        new_pregnancy_visit = VisitPregnancy(
            visit_id=new_visit.visit_id,
            pr_id = pregnancy_record.pr_id,
            blood_pressure=data.get('blood_pressure'),
            weight_kg=clean_float(data.get('weight')),
            height_cm=clean_float(data.get('height')),
            body_temperature=clean_float(data.get('temperature')),
            respiratory_rate=clean_float(data.get('respiratory_rate')),
            heart_rate=clean_float(data.get('heart_rate')),
            subjective=data.get('subjective'),
            objective=data.get('objective'),
            assessment=data.get('assessment'),
            plan=data.get('plan')
        )
        
        db.session.add(new_pregnancy_visit)
        db.session.flush() 

        auto_desc = f"Pemasukan dari kunjungan {medical_record.record_number} - {patient_name}"
        final_description = data.get("payment_description") or auto_desc
        
        next_seq = reserve_next_sequence(current_year)
        trx_number = generate_financial_number(current_year, next_seq)


        count = Financial.query.filter(
            Financial.clinic_id == clinic_id,
            db.extract('year', Financial.payment_date) == current_year
        ).count()
        
        trx_number = generate_financial_number(year=current_year, sequence_number=count + 1)
        new_financial = Financial(
            visit_id=new_visit.visit_id,
            user_id=user_id,
            patient_id=medical_record.patient_id,
            transaction_number=trx_number, 
            clinic_id=clinic_id,
            trans_type='pemasukan', 
            amount=clean_float(data.get("total")),
            payment_method=data.get("payment_method"),
            status=data.get("payment_status", "unpaid"), 
            payment_date=now_jakarta,
            description=final_description
        )
        db.session.add(new_financial)
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
        
        current_finance = Financial.query.filter_by(visit_id=uuid).first()
        
        decrypted_subjective = decrypt_data(current_pregnancy_visit.subjective)
        decrypted_objective = decrypt_data(current_pregnancy_visit.objective)
        decrypted_assessment = decrypt_data(current_pregnancy_visit.assessment)
        decrypted_plan = decrypt_data(current_pregnancy_visit.plan)
        decrypt_description = decrypt_data(current_finance.description)

        return jsonify({
          "subjective": decrypted_subjective or "-",
          "objective": decrypted_objective or "-", 
          "assessment": decrypted_assessment or "-",
          "plan": decrypted_plan or "-",
          "weight": current_pregnancy_visit.weight_kg or "-", 
          "height": current_pregnancy_visit.height_cm or "-",
          "body_temperature": current_pregnancy_visit.body_temperature or "-",
          "respiratory_rate": current_pregnancy_visit.respiratory_rate or "-",
          "heart_rate": current_pregnancy_visit.heart_rate or "-",
          "blood_pressure": current_pregnancy_visit.blood_pressure or "-",
          "visit_number": visit_report.visit_number,
          "finance": {
                "invoice_number": current_finance.transaction_number,
                "description": decrypt_description,
                "total_amount": current_finance.amount,
                "status": current_finance.status,
                "payment_method": current_finance.payment_method
          }
        }), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500


@visit_report_bp.route('/update-visit-pregnancy/<uuid>', methods=['PUT'])
@jwt_required()
def update_pregnancy_visit_report(uuid):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong"}), 400

        current_pregnancy_visit = VisitPregnancy.query.filter_by(visit_id=uuid).first()
        if not current_pregnancy_visit:
            return jsonify({"msg": "Data Kehamilan tidak ditemukan"}), 404

        new_weight = data.get('weight', '')
        new_height = data.get('height', '')
        new_body_temperature = data.get('body_temperature', '')
        new_respiratory_rate = data.get('respiratory_rate', '')
        new_heart_rate = data.get('heart_rate', '')
        new_blood_pressure = data.get('blood_pressure', '')
        new_subjective = data.get('subjective', '')
        new_objective = data.get('objective', '')
        new_assessment = data.get('assessment', '')
        new_plan = data.get('plan', '')

        current_pregnancy_visit.weight_kg = new_weight
        current_pregnancy_visit.height_cm = new_height
        current_pregnancy_visit.body_temperature = new_body_temperature
        current_pregnancy_visit.respiratory_rate = new_respiratory_rate
        current_pregnancy_visit.heart_rate = new_heart_rate
        current_pregnancy_visit.blood_pressure = new_blood_pressure
        current_pregnancy_visit.subjective =new_subjective
        current_pregnancy_visit.objective = new_objective
        current_pregnancy_visit.assessment = new_assessment
        current_pregnancy_visit.plan = new_plan

        db.session.commit()

        return jsonify({
            "msg": "Catatan medis berhasil diperbarui",
            "visit_id": uuid
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "msg": "Terjadi kesalahan pada server", 
            "error": str(e)
        }), 500


@visit_report_bp.route('/add-visit-family-planning', methods=['POST'])
@jwt_required()
def add_visit_familyplanning():
    user_id = get_jwt_identity()
    data = request.get_json()
    claims = get_jwt()
    record_id = data.get('record_id')
    jakarta_tz = pytz.timezone('Asia/Jakarta')
    now_jakarta = datetime.now(jakarta_tz)
    current_year = now_jakarta.year
    kb_record = FamilyPlanningRecord.query.filter_by(record_id=record_id).first()
    clinic_id = claims.get("clinic_id")

    medical_record = MedicalRecord.query.get(record_id)
    if not medical_record:
        return jsonify({"msg": "Data rekam medis tidak ditemukan"}), 404
    try:
        patient = Patient.query.get(medical_record.patient_id)
        patient_name = patient.patient_name if patient else "Pasien"
       #Add visit master
        new_visit = VisitMaster(
            record_id=record_id,
            user_id=user_id,
            visit_number=data.get('visit_number'),
            visit_date= now_jakarta,
            visit_time= now_jakarta
        )
        db.session.add(new_visit)
        db.session.flush() 
        
        # 2. Add Visit Family Planning
        new_familyplanning_visit = VisitFamilyPlanning(
            visit_id=new_visit.visit_id,
            kb_id = kb_record.kb_id,
            weight_kg= clean_float(data.get('weight')),
            blood_pressure = data.get('blood_pressure'),
            kb_method=data.get('contraceptive_method'),
            return_visit_date=data.get('return_visit_date'),
            complaint=data.get('complaint')
        )
        
        db.session.add(new_familyplanning_visit)
        db.session.flush()

        auto_desc = f"Pemasukan dari kunjungan {medical_record.record_number} - {patient_name}"
        final_description = data.get("payment_description") or auto_desc
        
        next_seq = reserve_next_sequence(current_year)
        trx_number = generate_financial_number(current_year, next_seq)

        count = Financial.query.filter(
            Financial.clinic_id == clinic_id,
            db.extract('year', Financial.payment_date) == current_year
        ).count()
        
        trx_number = generate_financial_number(year=current_year, sequence_number=count + 1)
        new_financial = Financial(
            visit_id=new_visit.visit_id,
            user_id=user_id,
            patient_id=medical_record.patient_id,
            transaction_number=trx_number, 
            clinic_id=clinic_id,
            trans_type='pemasukan', 
            amount=clean_float(data.get("total")),
            payment_method=data.get("payment_method"),
            status=data.get("payment_status", "unpaid"), 
            payment_date=now_jakarta,
            description=final_description
        )
        db.session.add(new_financial)
        db.session.commit()
        
        
        return jsonify({
            "msg": "Visit added successfully", 
            "rm_number": new_visit.record_id,
            "visit_id": new_visit.visit_id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to add visit", "error": str(e)}), 500
    
@visit_report_bp.route('/get-visit-family-planning/<uuid>', methods=['GET'])
@jwt_required()
def get_familyplanning_visit(uuid):
    try:
        visit_report=VisitMaster.query.filter_by(visit_id=uuid).first()
        if not visit_report:
            return jsonify({"msg": "Data kunjungan tidak ditemukan"}), 404

        current_familyplanning_visit = VisitFamilyPlanning.query.filter_by(visit_id=uuid).first()
        if not  current_familyplanning_visit:
            return jsonify({"msg": "Data KB tidak ditemukan"}), 404
        
        current_finance = Financial.query.filter_by(visit_id=uuid).first()
        

        decrypted_complaint = decrypt_data(current_familyplanning_visit.complaint)

        return jsonify({
            "complaint": decrypted_complaint,
            "weight_kg": clean_float(current_familyplanning_visit.weight_kg),
            "visit_number": visit_report.visit_number if visit_report else "-",
            "blood_pressure": current_familyplanning_visit.blood_pressure,
            "contraceptive_method": current_familyplanning_visit.kb_method,
            "return_visit_date": format_date(current_familyplanning_visit.return_visit_date) if current_familyplanning_visit.return_visit_date else None,
            "finance": {
                "invoice_number": current_finance.transaction_number if current_finance else "-",
                "total_amount": current_finance.amount if current_finance else "0",
                "payment_method": current_finance.payment_method if current_finance else "-",
                "status": current_finance.status if current_finance else "-"
            }   
        }), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

@visit_report_bp.route('/update-visit-family-planning/<uuid>', methods=['PUT'])
@jwt_required()
def update_familyplanning_visit_report(uuid):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong"}), 400

        current_familyplanning_visit = VisitFamilyPlanning.query.filter_by(visit_id=uuid).first()
        if not current_familyplanning_visit:
            return jsonify({"msg": "Data KB tidak ditemukan"}), 404
        
        

        new_weight = data.get('weight_kg', '')
        new_blood_pressure = data.get('blood_pressure', '')
        new_contraceptive_method = data.get('contraceptive_method', '')
        new_return_visit_date = data.get('return_visit_date', '')

        current_familyplanning_visit.weight_kg = new_weight
        current_familyplanning_visit.blood_pressure = new_blood_pressure
        current_familyplanning_visit.kb_method = new_contraceptive_method
        current_familyplanning_visit.return_visit_date = new_return_visit_date

        db.session.commit()

        return jsonify({
            "msg": "Catatan medis SOAP berhasil diperbarui",
            "visit_id": uuid
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "msg": "Terjadi kesalahan pada server", 
            "error": str(e)
        }), 500

@visit_report_bp.route('/add-visit-immunization', methods=['POST'])
@jwt_required()
def add_visit_immunization():
    user_id = get_jwt_identity()
    data = request.get_json()
    claims = get_jwt()
    record_id = data.get('record_id')
    vaccine_given = data.get('vaccine_given') 
    dosage_given = data.get('dosage_given')  
    jakarta_tz = pytz.timezone('Asia/Jakarta')
    now_jakarta = datetime.now(jakarta_tz)
    visit_date = now_jakarta.date()
    current_year = now_jakarta.year
    clinic_id = claims.get("clinic_id")

    medical_record = MedicalRecord.query.get(record_id)
    if not medical_record:
        return jsonify({"msg": "Data rekam medis tidak ditemukan"}), 404
    
    try:
        patient = Patient.query.get(medical_record.patient_id)
        patient_name = patient.patient_name if patient else "Pasien"
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
               return jsonify({"msg": f"Jenis vaksin '{vaccine_given}' tidak dikenali sistem"}), 400
       
        new_visit = VisitMaster(
            record_id=record_id,
            user_id=user_id,
            visit_number=data.get('visit_number'),
            visit_date=now_jakarta,
            visit_time=now_jakarta
        )
        db.session.add(new_visit)
        db.session.flush()

        auto_desc = f"Pemasukan dari kunjungan {medical_record.record_number} - {patient_name}"
        final_description = data.get("payment_description") or auto_desc
        
        next_seq = reserve_next_sequence(current_year)
        trx_number = generate_financial_number(current_year, next_seq)

        count = Financial.query.filter(
            Financial.clinic_id == clinic_id,
            db.extract('year', Financial.payment_date) == current_year
        ).count()
        
        trx_number = generate_financial_number(year=current_year, sequence_number=count + 1)
        new_financial = Financial(
            visit_id=new_visit.visit_id,
            user_id=user_id,
            patient_id=medical_record.patient_id,
            transaction_number=trx_number, 
            clinic_id=clinic_id,
            trans_type='pemasukan', 
            amount=clean_float(data.get("total")),
            payment_method=data.get("payment_method"),
            status=data.get("payment_status", "unpaid"), 
            payment_date=now_jakarta,
            description=final_description
        )
        db.session.add(new_financial)

        new_detail = VisitImunization(
            visit_id=new_visit.visit_id,
            ir_id=imm_record.ir_id,
            baby_weight=clean_float(data.get('weight_kg')),
            baby_height=clean_float(data.get('height_cm')),
            body_temp=clean_float(data.get('body_temperature')),
            head_circumference=clean_float(data.get('head_circumference')),
            abdominal_circumference=clean_float(data.get('abdominal_circumference')),
            dosage_given=dosage_given if dosage_given else None,
            vaccine_given=vaccine_given if vaccine_given else None
        )
        db.session.add(new_detail)
        
        db.session.commit()
        return jsonify({"msg": "Data Imunisasi Berhasil Disimpan!"}), 201
    except Exception as e:
            db.session.rollback()
            return jsonify({"msg": "Gagal simpan data", "error": str(e)}), 500
    
@visit_report_bp.route('/get-visit-immunization/<uuid>', methods=['GET'])
@jwt_required()
def get_immunization_visit(uuid):
    try:
        visit_report=VisitMaster.query.filter_by(visit_id=uuid).first()
        if not visit_report:
            return jsonify({"msg": "Data kunjungan tidak ditemukan"}), 404

        current_immunization_visit = VisitImunization.query.filter_by(visit_id=uuid).first()
        if not  current_immunization_visit:
            return jsonify({"msg": "Data Imunisasi tidak ditemukan"}), 404
        
        current_finance = Financial.query.filter_by(visit_id=uuid).first()

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
                "total_amount": current_finance.amount if current_finance else "0",
                "payment_method": current_finance.payment_method if current_finance else "-",
                "status": current_finance.status if current_finance else "-"
            }
        }), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

@visit_report_bp.route('/update-visit-immunization/<uuid>', methods=['PUT'])
@jwt_required()
def update_immunization_visit(uuid):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong"}), 400

        current_immunization_visit = VisitImunization.query.filter_by(visit_id=uuid).first()
        if not current_immunization_visit:
            return jsonify({"msg": "Data Imunisasi tidak ditemukan"}), 404
        
        current_imm_record = ImmunizationRecord.query.get(current_immunization_visit.ir_id)
        if not current_imm_record:
            return jsonify({"msg": "Data Rekam Imunisasi tidak ditemukan"}), 404

        new_vaccine_given = data.get('vaccine_given', '')
        new_dosage_given = data.get('dosage_given', '')
        
        if (current_immunization_visit.vaccine_given != new_vaccine_given) or \
           (current_immunization_visit.dosage_given != new_dosage_given):
            
            if current_immunization_visit.vaccine_given and current_immunization_visit.dosage_given:
                old_col_name = get_column_name(
                    current_immunization_visit.vaccine_given, 
                    current_immunization_visit.dosage_given
                )
                
                if old_col_name and hasattr(current_imm_record, old_col_name):
                    setattr(current_imm_record, old_col_name, None)
        
        if new_vaccine_given and new_dosage_given:
            col_name = get_column_name(new_vaccine_given, new_dosage_given)
        
            if col_name and hasattr(current_imm_record, col_name):
                from app.models import VisitMaster
                master_visit = VisitMaster.query.get(uuid)
                target_date = master_visit.visit_date if master_visit else datetime.now().date()
                
                setattr(current_imm_record, col_name, target_date)
            else:
                return jsonify({"msg": f"Jenis vaksin '{new_vaccine_given}' atau dosis tidak dikenali sistem"}), 400
            
        new_weight = data.get('weight_kg', '')
        new_height = data.get('height_cm', '')
        new_body_temperature = data.get('body_temperature', '')
        new_head_circumference = data.get('head_circumference', '')
        new_abdominal_circumference = data.get('abdominal_circumference', '')
      
        current_immunization_visit.weight_kg = new_weight
        current_immunization_visit.height_cm = new_height
        current_immunization_visit.body_temp = new_body_temperature
        current_immunization_visit.head_circumference = new_head_circumference
        current_immunization_visit.abdominal_circumference = new_abdominal_circumference
        current_immunization_visit.vaccine_given = new_vaccine_given
        current_immunization_visit.dosage_given = new_dosage_given

        db.session.commit()

        return jsonify({
            "msg": "Catatan medis imunisasi berhasil diperbarui",
            "visit_id": uuid
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "msg": "Terjadi kesalahan pada server", 
            "error": str(e)
        }), 500
        
        
@visit_report_bp.route('/add-visit-general', methods=['POST'])
@jwt_required()
def add_visit_general():
    user_id = get_jwt_identity()
    data = request.get_json()
    claims = get_jwt()
    jakarta_tz = pytz.timezone('Asia/Jakarta')
    now_jakarta = datetime.now(jakarta_tz)
    current_year = now_jakarta.year
    clinic_id = claims.get("clinic_id")
    record_id = data.get('record_id')
    
    medical_record = MedicalRecord.query.get(record_id)
    if not medical_record:
        return jsonify({"msg": "Data rekam medis tidak ditemukan"}), 404
    try:
        patient = Patient.query.get(medical_record.patient_id)
        patient_name = patient.patient_name if patient else "Pasien"
        gen_record = GeneralRecord.query.filter_by(record_id=record_id).first()
       #Add visit master
        new_visit = VisitMaster(
            record_id=data.get('record_id'),
            user_id=user_id,
            visit_number=data.get('visit_number'),
            visit_date=now_jakarta,
            visit_time=now_jakarta
        )
        db.session.add(new_visit)
        db.session.flush() 
        
        # 2. Add Visit Pregnancy
        new_general_visit = VisitGeneral(
            visit_id=new_visit.visit_id,
            gr_id = gen_record.gr_id,
            subjective=data.get('subjective'),
            objective=data.get('objective'),
            assessment=data.get('assessment'),
            plan=data.get('plan')
        )
        
        db.session.add(new_general_visit)
        db.session.flush()
    
        auto_desc = f"Pemasukan dari kunjungan {medical_record.record_number} - {patient_name}"
        final_description = data.get("payment_description") or auto_desc
        
        next_seq = reserve_next_sequence(current_year)
        trx_number = generate_financial_number(current_year, next_seq)

        count = Financial.query.filter(
            Financial.clinic_id == clinic_id,
            db.extract('year', Financial.payment_date) == current_year
        ).count()
        
        trx_number = generate_financial_number(year=current_year, sequence_number=count + 1)
        new_financial = Financial(
            visit_id=new_visit.visit_id,
            user_id=user_id,
            patient_id=medical_record.patient_id,
            transaction_number=trx_number, 
            clinic_id=clinic_id,
            trans_type='pemasukan', 
            amount=clean_float(data.get("total")),
            payment_method=data.get("payment_method"),
            status=data.get("payment_status", "unpaid"), 
            payment_date=now_jakarta,
            description=final_description
        )
        db.session.add(new_financial) 
        db.session.commit()
        
        
        return jsonify({
            "msg": "Visit added successfully", 
            "rm_number": new_visit.record_id,
            "visit_id": new_visit.visit_id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to add visit", "error": str(e)}), 500
    
@visit_report_bp.route('/get-visit-general/<uuid>', methods=['GET'])
@jwt_required()
def get_general_visit(uuid):
    try:
        visit_report=VisitMaster.query.filter_by(visit_id=uuid).first()
        if not visit_report:
            return jsonify({"msg": "Data kunjungan tidak ditemukan"}), 404

        current_general_visit  = VisitGeneral.query.filter_by(visit_id=uuid).first()
        if not current_general_visit:
            return jsonify({"msg": "Data Imunisasi tidak ditemukan"}), 404
        
        current_finance = Financial.query.filter_by(visit_id=uuid).first()

        decrypted_subjective = decrypt_data(current_general_visit.subjective)
        decrypted_objective = decrypt_data(current_general_visit.objective)
        decrypted_assessment = decrypt_data(current_general_visit.assessment)
        decrypted_plan = decrypt_data(current_general_visit.plan)

        return jsonify({
          "subjective": decrypted_subjective,
          "objective": decrypted_objective, 
          "assessment": decrypted_assessment,
          "plan": decrypted_plan,
          "finance": {
                "invoice_number": current_finance.transaction_number if current_finance else "-",
                "total_amount": current_finance.amount if current_finance else "0",
                "payment_method": current_finance.payment_method if current_finance else "-",
                "status": current_finance.status if current_finance else "-"
            } 
        }), 200

    except Exception as e:
        return jsonify({"msg": "Server error", "error": str(e)}), 500

@visit_report_bp.route('/update-visit-general/<uuid>', methods=['PUT'])
@jwt_required()
def update_general_visit_report(uuid):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"msg": "Payload data tidak boleh kosong"}), 400

        current_general_visit = VisitGeneral.query.filter_by(visit_id=uuid).first()
        if not current_general_visit:
            return jsonify({"msg": "Data kunjungan umum tidak ditemukan"}), 404
        

        new_subjective = data.get('subjective', '')
        new_objective = data.get('objective', '')
        new_assessment = data.get('assessment', '')
        new_plan = data.get('plan', '')

        current_general_visit.subjective = new_subjective
        current_general_visit.objective = new_objective
        current_general_visit.assessment = new_assessment
        current_general_visit.plan = new_plan

        db.session.commit()

        return jsonify({
            "msg": "Catatan medis SOAP berhasil diperbarui",
            "visit_id": uuid
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "msg": "Terjadi kesalahan pada server", 
            "error": str(e)
        }), 500

@visit_report_bp.route('/delete-visit/<uuid:visit_id>', methods=['DELETE'])
@jwt_required()
def delete_visit(visit_id):
    try:
        visit = VisitMaster.query.get(visit_id)
        if not visit:
            return jsonify({"msg": "Data kunjungan tidak ditemukan"}), 404

        VisitGeneral.query.filter_by(visit_id=visit_id).delete()

        Financial.query.filter_by(visit_id=visit_id).delete()

        db.session.delete(visit)
        
        db.session.commit()
        
        return jsonify({"msg": "Data kunjungan dan invoice terkait berhasil dihapus"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error Delete Visit: {str(e)}")
        return jsonify({"msg": "Gagal menghapus data kunjungan", "error": str(e)}), 500
    
@visit_report_bp.route('/search-visit', methods=['GET'])
@jwt_required()
def search_visit():
    try:
        search_query = request.args.get('query', '').lower()
        
        results = db.session.query(VisitMaster, MedicalRecord, Patient, User).\
            join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id).\
            join(Patient, MedicalRecord.patient_id == Patient.patient_id).\
            join(User, VisitMaster.user_id == User.user_id).\
            all()
        matched_records = []

        for visit, medical_record, patient, user in results:
            raw_name = decrypt_data(patient.patient_name)
            raw_nik = decrypt_data(patient.national_id)
            
            decrypted_name = str(raw_name).lower() if raw_name else ""
            decrypted_nik = str(raw_nik).lower() if raw_nik else ""
            record_number = str(medical_record.record_number).lower()
            visit_number = str(visit.visit_number).lower()
            
         
            if (search_query in decrypted_name or 
                search_query in decrypted_nik or 
                search_query in record_number or
                search_query in visit_number):
                
                matched_records.append({
                    "visit_id": visit.visit_id,
                    "visit_date": f"{format_date(visit.visit_date)} {visit.visit_time.strftime('%H:%M')}",
                    "visit_number": visit.visit_number,
                    "record_number": medical_record.record_number,
                    "patient_name": decrypted_name.title(),
                    "nik": decrypted_nik,
                    "record_type": medical_record.record_type,
                    "made_by": user.fullname 
                })

        return jsonify(matched_records), 200

    except Exception as e:
        print(f"Search Error: {str(e)}")
        return jsonify({"msg": "Server error", "error": str(e)}), 500

@visit_report_bp.route('/filter-all', methods=['GET'])
@jwt_required() # Pastikan diproteksi JWT
def filter_all_visits():
    try:
        claims = get_jwt()
        clinic_id = claims.get("clinic_id")

        search_query = request.args.get('search', '').strip().lower()
        rm_type = request.args.get('type', 'All')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')

        # 1. Bangun query dasar tanpa memfilter nama/NIK dulu lewat SQL ilike
        query = db.session.query(VisitMaster, MedicalRecord, Patient, User).\
            join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id).\
            join(Patient, MedicalRecord.patient_id == Patient.patient_id).\
            join(User, VisitMaster.user_id == User.user_id).\
            filter(User.clinic_id == clinic_id) # Amankan multi-tenancy klinik

        # 2. Filter tipe RM (jika bukan 'All' atau 'Semua')
        if rm_type != 'All' and rm_type != 'Semua':
            query = query.filter(MedicalRecord.record_type == rm_type)

        # 3. Filter rentang tanggal kedatangan
        if start_date and end_date:
            query = query.filter(VisitMaster.visit_date.between(start_date, end_date))

        results = query.order_by(
            VisitMaster.visit_date.desc(), 
            VisitMaster.visit_time.desc()
        ).all()

        visit_list = []
        
        # 4. Iterasi hasil query, lakukan dekripsi, dan filter search_query menggunakan Python
        for visit, medical_record, patient, user in results:
            decrypted_name = decrypt_data(patient.patient_name)
            decrypted_nik = decrypt_data(patient.national_id)

            str_name = str(decrypted_name).lower() if decrypted_name else ""
            str_nik = str(decrypted_nik).lower() if decrypted_nik else ""
            record_number = str(medical_record.record_number).lower()
            visit_number = str(visit.visit_number).lower()

            # JIKA user mengisi search_query, lakukan pencocokan teks pasca-dekripsi
            if search_query:
                if not (search_query in str_name or 
                        search_query in str_nik or 
                        search_query in record_number or 
                        search_query in visit_number):
                    continue # Lewati data ini jika tidak ada yang cocok

            # Masukkan data yang lolos filter ke dalam list hasil
            visit_list.append({
                "visit_id": visit.visit_id,
                "visit_date": f"{format_date(visit.visit_date)} {visit.visit_time.strftime('%H:%M')}",
                "visit_number": visit.visit_number,
                "record_number": medical_record.record_number,
                "patient_name": str_name.title() if decrypted_name else "Unknown",
                "nik": decrypted_nik if decrypted_nik else "-",
                "record_type": medical_record.record_type,
                "made_by": user.fullname
            })

        return jsonify(visit_list), 200

    except Exception as e:
        print(f"Error Filter All: {str(e)}")
        return jsonify({
            "msg": "Gagal mengambil data kunjungan terfilter",
            "error": str(e)
        }), 500

@visit_report_bp.route('/json-visit', methods=['GET'])
@jwt_required()
def get_json_visit_report():
    try:
        claims = get_jwt()
        clinic_id = claims.get("clinic_id")

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        visit_type = request.args.get('visit_type', 'Semua')
        search_query = request.args.get('search', '').strip().lower() 
        query = db.session.query(
            VisitMaster.visit_id,
            VisitMaster.visit_number,
            VisitMaster.visit_date,
            MedicalRecord.record_number,
            Patient.patient_name,
            Patient.national_id,    
            Patient.birth_date,    
            User.fullname
        ).join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)\
         .join(Patient, MedicalRecord.patient_id == Patient.patient_id)\
         .join(User, VisitMaster.user_id == User.user_id)\
         .filter(User.clinic_id == clinic_id)

        if start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            query = query.filter(db.func.date(VisitMaster.visit_date) >= start_date)\
                         .filter(db.func.date(VisitMaster.visit_date) <= end_date)

        raw_visits = query.order_by(VisitMaster.visit_date.desc()).all()
        results = []

        for visit in raw_visits:
            decrypted_name = decrypt_data(visit.patient_name)
            decrypted_nik = decrypt_data(visit.national_id)
            
            str_name = str(decrypted_name).lower() if decrypted_name else ""
            str_nik = str(decrypted_nik).lower() if decrypted_nik else ""
            str_birth_date = visit.birth_date.strftime('%Y-%m-%d') if visit.birth_date else ""
            record_number = str(visit.record_number).lower()
            visit_number = str(visit.visit_number).lower()

            if search_query:
                if not (search_query in str_name or 
                        search_query in str_nik or 
                        search_query in str_birth_date or 
                        search_query in record_number or 
                        search_query in visit_number):
                    continue

            row_data = {
                "visit_id": str(visit.visit_id),
                "visit_number": visit.visit_number,
                "visit_date": visit.visit_date.strftime('%Y-%m-%d %H:%M') if visit.visit_date else '-',
                "record_number": visit.record_number,
                "patient_name": str_name.title(), 
                "created_by": visit.fullname,
                "visit_type": "Umum" 
            }

            if visit_type in ['Umum', 'Semua']:
                general_detail = VisitGeneral.query.filter_by(visit_id=visit.visit_id).first()
                if general_detail:
                    row_data["visit_type"] = "Umum"
                    row_data["subjective"] = decrypt_data(general_detail.subjective)
                    row_data["objective"] = decrypt_data(general_detail.objective)
                    row_data["assessment"] = decrypt_data(general_detail.assessment)
                    row_data["plan"] = decrypt_data(general_detail.plan)
                    
                    financial_detail = Financial.query.filter_by(visit_id=visit.visit_id).first()
                    row_data["amount"] = financial_detail.amount if financial_detail else 0
                    row_data["status"] = financial_detail.status if financial_detail else "unpaid"

            pregnancy_detail = VisitPregnancy.query.filter_by(visit_id=visit.visit_id).first()
            
            if pregnancy_detail:
                row_data["visit_type"] = "Kehamilan" 
                
                if visit_type in ['Kehamilan', 'Semua']:
                    row_data["blood_pressure"] = decrypt_data(pregnancy_detail.blood_pressure)
                    row_data["weight_kg"] = decrypt_data(pregnancy_detail.weight_kg)   
                    row_data["height_cm"] = decrypt_data(pregnancy_detail.height_cm) 
                    row_data["body_temperature"] = decrypt_data(pregnancy_detail.body_temperature)   
                    row_data["respiratory_rate"] = decrypt_data(pregnancy_detail.respiratory_rate)   
                    row_data["heart_rate"] = decrypt_data(pregnancy_detail.heart_rate)
                    row_data["subjective"] = decrypt_data(pregnancy_detail.subjective)
                    row_data["objective"] = decrypt_data(pregnancy_detail.objective)
                    row_data["assessment"] = decrypt_data(pregnancy_detail.assessment)
                    row_data["plan"] = decrypt_data(pregnancy_detail.plan)
                    
                    financial_detail = Financial.query.filter_by(visit_id=visit.visit_id).first()
                    row_data["amount"] = financial_detail.amount if financial_detail else 0
                    row_data["status"] = financial_detail.status if financial_detail else "unpaid"
            
            immunization_detail = VisitImunization.query.filter_by(visit_id=visit.visit_id).first()
            
            if immunization_detail:
                row_data["visit_type"] = "Imunisasi" 
                
                if visit_type in ['Imunisasi', 'Semua']:
                    row_data["baby_weight"] = immunization_detail.baby_weight
                    row_data["baby_height"] = immunization_detail.baby_height
                    row_data["body_temp"] = immunization_detail.body_temp
                    row_data["head_circumference"] = immunization_detail.head_circumference
                    row_data["abdominal_circumference"] = immunization_detail.abdominal_circumference
                    row_data["dosage_given"] = immunization_detail.dosage_given
                    row_data["vaccine_given"] = immunization_detail.vaccine_given

                    financial_detail = Financial.query.filter_by(visit_id=visit.visit_id).first()
                    row_data["amount"] = financial_detail.amount if financial_detail else 0
                    row_data["status"] = financial_detail.status if financial_detail else "unpaid"

            familyplanning_detail = VisitFamilyPlanning.query.filter_by(visit_id=visit.visit_id).first()
            
            if familyplanning_detail:
                row_data["visit_type"] = "Keluarga Berencana" 
                
                if visit_type in ['Keluarga Berencana', 'Semua']:
                    row_data["weight_kg"] = familyplanning_detail.weight_kg
                    row_data["blood_pressure"] = familyplanning_detail.blood_pressure
                    row_data["kb_method"] = familyplanning_detail.kb_method
                    row_data["return_visit_date"] = familyplanning_detail.return_visit_date
                    row_data["complaint"] = decrypt_data(familyplanning_detail.complaint)

                    financial_detail = Financial.query.filter_by(visit_id=visit.visit_id).first()
                    row_data["amount"] = financial_detail.amount if financial_detail else 0
                    row_data["status"] = financial_detail.status if financial_detail else "unpaid"

            if visit_type == 'Semua' or row_data["visit_type"] == visit_type:
                results.append(row_data)

        return jsonify({"status": "success", "results": results}), 200

    except Exception as e:
        import traceback
        print(traceback.format_exc()) 
        return jsonify({"msg": "Internal server error", "error": str(e)}), 500