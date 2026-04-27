from flask_sqlalchemy import SQLAlchemy
from passlib.hash import bcrypt
import uuid
from app import db
from datetime import datetime
from app.utils import encrypt_data, decrypt_data
from sqlalchemy.ext.hybrid import hybrid_property
import sqlalchemy as sa
from sqlalchemy.types import TypeDecorator, Text

class EncryptedText(TypeDecorator):
    impl = Text
   
    def process_bind_param(self, value, dialect):
        if value is not None:
           return encrypt_data(value)
        return value
   
    def process_result_value(self, value, dialect):
        if value is not None:
            return decrypt_data(value)
        return value
   

class Clinic(db.Model):
    __tablename__ = 'clinic'
    
    clinic_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    clinic_name = db.Column(db.String(255), nullable=False)
    clinic_address = db.Column(db.Text, nullable=False)
    license_number = db.Column(db.String(100), nullable = False)
    clinic_email = db.Column(db.String(255), nullable=False)
    clinic_phone = db.Column(db.String(20), nullable=False)    
    
class User(db.Model):
    __tablename__ = 'users'
    
    user_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    clinic_id = db.Column(db.String(36), db.ForeignKey('clinic.clinic_id'), nullable=True)
    fullname = db.Column(db.String(50), nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    user_role = db.Column(db.String(20), nullable=False)
    strnumber = db.Column(db.String(100), nullable = True)
    email = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def set_password(self, password):
      self.password_hash = bcrypt.hash(password[:72])
        
    def check_password(self, password):
        return bcrypt.verify(password[:72], self.password_hash)
    
class Patient(db.Model):
    __tablename__ = 'patient'
    patient_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    clinic_id = db.Column(db.String(36), db.ForeignKey('clinic.clinic_id'), nullable=True)
    family_link_id = db.Column(db.String(36), db.ForeignKey('patient.patient_id'), nullable=True)
    patient_name = db.Column(EncryptedText, nullable=False)
    birth_date = db.Column(db.Date, nullable=False)
    role = db.Column(db.String(20), default='self')
    national_id = db.Column(EncryptedText, nullable=True)
    address = db.Column(EncryptedText, nullable=False)
    patient_number = db.Column(EncryptedText, nullable=True)
    gender = db.Column(db.String(10), nullable=False)
    education_level = db.Column(db.String(20), nullable=True)
    occupation = db.Column(db.String(100), nullable=True)
    insurance_number = db.Column(EncryptedText, nullable=True)
    primary_health_facility = db.Column(db.String(255), nullable=True)
    relation = db.Column(db.String(50))
    
    family_members = db.relationship(
        'Patient', 
        backref=db.backref('parent_link', remote_side=[patient_id]),
        cascade="all, delete-orphan"
    )
    
    @hybrid_property
    def age(self):
        if self.birth_date:
            today = datetime.today()
            return today.year - self.birth_date.year - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
        return 0
    
class MedicalRecord(db.Model):
    __tablename__ = 'medical_record'
    
    record_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey('patient.patient_id'), nullable=False)
    record_number = db.Column(db.String(20), unique=True, nullable=False)
    record_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_update = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
class PregnancyRecord(db.Model):
    __tablename__ = 'pregnancy_record'
    
    pr_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = db.Column(db.String(36), db.ForeignKey('medical_record.record_id'), nullable=False)
    contraceptive_history = db.Column(EncryptedText, nullable=True)
    family_med_history = db.Column(EncryptedText, nullable=True)
    last_menstrual_period = db.Column(db.Date, nullable=True)
    expected_due_date = db.Column(db.Date, nullable=True)
    diagnosis = db.Column(EncryptedText, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    muac_cm = db.Column(db.Float, nullable=True)
    tt_screening = db.Column(db.String(50), nullable=True)
    registration_date = db.Column(db.DateTime, default=datetime.utcnow)
    lab_results = db.Column(EncryptedText, nullable=True)
    pre_preg_muac_cm = db.Column(db.Float, nullable=True)
    pre_preg_weight_kg = db.Column(db.Float, nullable=True)
    
class ObstetricHistory(db.Model):
    __tablename__ = 'obstetric_history'
    
    history_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pr_id = db.Column(db.String(36), db.ForeignKey('pregnancy_record.pr_id'), nullable=False)
    pregnancy_no = db.Column(db.Integer, nullable=True)
    gestational_age = db.Column(db.Integer, nullable=True)
    pregnancy_complications = db.Column(EncryptedText, nullable=True)
    delivery_mode = db.Column(db.String(50), nullable=True)
    delivery_complications = db.Column(EncryptedText, nullable=True)
    baby_weight_height = db.Column(EncryptedText, nullable=True)
    baby_complications = db.Column(EncryptedText, nullable=True)
    postpartum_status = db.Column(EncryptedText, nullable=True)
    postpartum_complications = db.Column(EncryptedText, nullable=True)
    
class FamilyPlanningRecord(db.Model):
    __tablename__ = 'kb_record'
    
    kb_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = db.Column(db.String(36), db.ForeignKey('medical_record.record_id'), nullable=False)
    number_of_children= db.Column(db.Integer, nullable=True)
    youngest_child_age= db.Column(db.Text, nullable=True)
    family_med_history = db.Column(EncryptedText, nullable=True)

class GeneralRecord(db.Model):
    __tablename__ = 'general_record'
    
    gr_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = db.Column(db.String(36), db.ForeignKey('medical_record.record_id'), nullable=False)

class DeliveryRecord(db.Model):
    __tablename__ = 'delivery_record'
    
    dr_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = db.Column(db.String(36), db.ForeignKey('medical_record.record_id'), nullable=False)
    delivery_date = db.Column(db.Date, nullable=True)
    delivery_type = db.Column(db.String(100), nullable=True)
    deliver_complications = db.Column(EncryptedText, nullable=True)
    baby_gender = db.Column(db.String(10), nullable=False)
    baby_weight = db.Column(db.String(20), nullable=True)
    baby_length = db.Column(db.String(20), nullable=True)
    apgar_score = db.Column(db.String(10), nullable=True)
    baby_complications = db.Column(EncryptedText, nullable=True)
    vit_k_given = db.Column(db.Boolean, default=False, nullable=False)
    hbo_given = db.Column(db.Boolean, default=False, nullable=False)
    eye_ointment = db.Column(db.Boolean, default=False, nullable=False)
    imd = db.Column(db.Boolean, default=False, nullable=False)

class ImmunizationRecord(db.Model):
    __tablename__ = 'immunization_record'
    
    ir_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = db.Column(db.String(36), db.ForeignKey('medical_record.record_id'), nullable=False)
    hbo_1 = db.Column(db.Date, nullable=True)
    bcg_1 = db.Column(db.Date, nullable=True)
    polio_1 = db.Column(db.Date, nullable=True)
    polio_2 = db.Column(db.Date, nullable=True)
    polio_3 = db.Column(db.Date, nullable=True)
    polio_4 = db.Column(db.Date, nullable=True)
    dpt_1 = db.Column(db.Date, nullable=True)
    dpt_2= db.Column(db.Date, nullable=True)
    dpt_3 = db.Column(db.Date, nullable=True)
    dpt_4 = db.Column(db.Date, nullable=True)
    pcv_1 = db.Column(db.Date, nullable=True)
    pcv_2 = db.Column(db.Date, nullable=True)
    pcv_3 = db.Column(db.Date, nullable=True)
    campak_1 = db.Column(db.Date, nullable=True)
    campak_2 = db.Column(db.Date, nullable=True)
    ipv_1 = db.Column(db.Date, nullable=True)
    ipv_2 = db.Column(db.Date, nullable=True)
    
class VisitMaster(db.Model):
    __tablename__ = 'visit_master'
    
    visit_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = db.Column(db.String(36), db.ForeignKey('medical_record.record_id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=False)
    visit_number = db.Column(db.String(20), unique=True, nullable=False)
    visit_date = db.Column(db.DateTime, default=datetime.utcnow)
    visit_time = db.Column(db.DateTime, default=datetime.utcnow)
    
class VisitPregnancy(db.Model):
    __tablename__ = 'pregnancy_visit'
    
    visit_anc_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    visit_id = db.Column(db.String(36), db.ForeignKey('visit_master.visit_id'), nullable=False)
    pr_id = db.Column(db.String(36), db.ForeignKey('pregnancy_record.pr_id'), nullable=False)
    blood_pressure = db.Column(db.String(20), nullable=True)
    weight_kg = db.Column(db.String(20), nullable=True)
    height_cm = db.Column(db.String(20), nullable=True)
    blood_pressure = db.Column(db.String(20), nullable=True)
    body_temperature = db.Column(db.String(20), nullable=True)
    respiratory_rate = db.Column(db.String(20), nullable=True)
    heart_rate = db.Column(db.String(20), nullable=True)
    subjective= db.Column(EncryptedText, nullable=True)
    objective = db.Column(EncryptedText, nullable=True)
    assessment = db.Column(EncryptedText, nullable=True)
    plan = db.Column(EncryptedText, nullable=True)


    