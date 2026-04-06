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
    national_id = db.Column(EncryptedText, nullable=True)
    address = db.Column(EncryptedText, nullable=False)
    patient_number = db.Column(EncryptedText, nullable=True)
    gender = db.Column(db.String(10), nullable=False)
    education_level = db.Column(db.String(20), nullable=True)
    occupation = db.Column(db.String(100), nullable=True)
    insurance_number = db.Column(EncryptedText, nullable=True)
    primary_health_facility = db.Column(db.String(255), nullable=True)
    
    @hybrid_property
    def age(self):
        today = date.today()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))
    
class MedicalRecord(db.Model):
    __tablename__ = 'medical_record'
    
    record_id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = db.Column(db.String(36), db.ForeignKey('patient.patient_id'), nullable=False)
    record_number = db.Column(db.String(20), unique=True, nullable=False)
    record_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_update = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)