from flask_sqlalchemy import SQLAlchemy
from passlib.hash import bcrypt
import uuid
from app import db
from datetime import datetime

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
    

    
    