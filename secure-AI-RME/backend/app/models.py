from flask_sqlalchemy import SQLAlchemy
from passlib.hash import bcrypt
import uuid
from app import db
from datetime import datetime
from app.utils import encrypt_data, decrypt_data
from sqlalchemy.ext.hybrid import hybrid_property
import sqlalchemy as sa
from sqlalchemy.types import TypeDecorator, Text
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID, JSONB


class EncryptedText(TypeDecorator):
    impl = Text

    cache_ok = True

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

    clinic_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    clinic_name = db.Column(db.String(255), nullable=False)
    clinic_address = db.Column(EncryptedText, nullable=False)
    license_number = db.Column(EncryptedText, nullable=False)
    clinic_email = db.Column(db.String(255), nullable=False)
    clinic_phone = db.Column(EncryptedText, nullable=False)


class User(db.Model):
    __tablename__ = 'users'

    user_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    clinic_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'),
        nullable=True,
    )
    fullname = db.Column(db.String(50), nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    user_role = db.Column(db.String(20), nullable=False)
    strnumber = db.Column(EncryptedText, nullable=True)
    email = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    profile_photo = db.Column(db.Text, nullable=True)

    last_login = db.Column(
        db.DateTime,
        nullable=False,
        server_default=text("timezone('Asia/Jakarta', now())"),
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=text("timezone('Asia/Jakarta', now())"),
    )
    
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True, server_default=text("timezone('Asia/Jakarta', now())"),)

    def set_password(self, password):
        self.password_hash = bcrypt.hash(password[:72])

    def check_password(self, password):
        return bcrypt.verify(password[:72], self.password_hash)


class Patient(db.Model):
    __tablename__ = 'patient'

    patient_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    clinic_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'),
        nullable=False,
    )
    family_link_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('patient.patient_id', ondelete='CASCADE'),
    )
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
        cascade='all, delete-orphan',
    )

    @hybrid_property
    def age(self):
        if self.birth_date:
            today = datetime.today()
            return (
                today.year
                - self.birth_date.year
                - ((today.month, today.day) < (self.birth_date.month, self.birth_date.day))
            )

        return 0


class MedicalRecord(db.Model):
    __tablename__ = 'medical_record'

    record_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    clinic_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'),
        nullable=False,
    )
    patient_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('patient.patient_id', ondelete='CASCADE'),
    )
    record_number = db.Column(db.String(20), unique=True, nullable=False)
    record_type = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_update = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

class MedicalRecordSequence(db.Model):
    __tablename__ = 'medical_record_sequence'

    year = db.Column(db.Integer, primary_key=True)
    record_type = db.Column(db.String(50), primary_key=True) 
    clinic_id = db.Column(UUID(as_uuid=True), db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'), primary_key=True)
    last_number = db.Column(db.Integer, nullable=False, default=0)

class PregnancyRecord(db.Model):
    __tablename__ = 'pregnancy_record'

    pr_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    record_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('medical_record.record_id', ondelete='CASCADE'),
    )
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

    history_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    pr_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('pregnancy_record.pr_id', ondelete='CASCADE'),
    )
    pregnancy_no = db.Column(db.Integer, nullable=True)
    gestational_age = db.Column(db.String(50), nullable=True)
    pregnancy_complications = db.Column(EncryptedText, nullable=True)
    delivery_mode = db.Column(db.String(50), nullable=True)
    delivery_complications = db.Column(EncryptedText, nullable=True)
    baby_weight = db.Column(db.Float, nullable=True)
    baby_height = db.Column(db.Float, nullable=True)
    baby_complications = db.Column(EncryptedText, nullable=True)
    postpartum_status = db.Column(db.String(50), nullable=True)
    postpartum_complications = db.Column(EncryptedText, nullable=True)


class FamilyPlanningRecord(db.Model):
    __tablename__ = 'kb_record'

    kb_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    record_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('medical_record.record_id', ondelete='CASCADE'),
    )
    number_of_children = db.Column(db.Integer, nullable=True)
    youngest_child_age = db.Column(db.Text, nullable=True)
    family_med_history = db.Column(EncryptedText, nullable=True)


class GeneralRecord(db.Model):
    __tablename__ = 'general_record'

    gr_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    record_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('medical_record.record_id', ondelete='CASCADE'),
    )


class DeliveryRecord(db.Model):
    __tablename__ = 'delivery_record'

    dr_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    record_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('medical_record.record_id', ondelete='CASCADE'),
    )
    delivery_date = db.Column(db.Date, nullable=True)
    delivery_type = db.Column(db.String(100), nullable=True)
    deliver_complications = db.Column(EncryptedText, nullable=True)
    baby_gender = db.Column(db.String(10), nullable=False)
    baby_weight = db.Column(db.Float, nullable=True)
    baby_length = db.Column(db.Float, nullable=True)
    apgar_score = db.Column(db.String(10), nullable=True)
    baby_complications = db.Column(EncryptedText, nullable=True)
    vit_k_given = db.Column(db.Boolean, default=False, nullable=False)
    hbo_given = db.Column(db.Boolean, default=False, nullable=False)
    eye_ointment = db.Column(db.Boolean, default=False, nullable=False)
    imd = db.Column(db.Boolean, default=False, nullable=False)


class ImmunizationRecord(db.Model):
    __tablename__ = 'immunization_record'

    ir_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    record_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('medical_record.record_id', ondelete='CASCADE'),
    )
    hbo_1 = db.Column(db.Date, nullable=True)
    bcg_1 = db.Column(db.Date, nullable=True)
    polio_1 = db.Column(db.Date, nullable=True)
    polio_2 = db.Column(db.Date, nullable=True)
    polio_3 = db.Column(db.Date, nullable=True)
    polio_4 = db.Column(db.Date, nullable=True)
    dpt_1 = db.Column(db.Date, nullable=True)
    dpt_2 = db.Column(db.Date, nullable=True)
    dpt_3 = db.Column(db.Date, nullable=True)
    dpt_4 = db.Column(db.Date, nullable=True)
    pcv_1 = db.Column(db.Date, nullable=True)
    pcv_2 = db.Column(db.Date, nullable=True)
    pcv_3 = db.Column(db.Date, nullable=True)
    campak_1 = db.Column(db.Date, nullable=True)
    campak_2 = db.Column(db.Date, nullable=True)
    ipv_1 = db.Column(db.Date, nullable=True)
    ipv_2 = db.Column(db.Date, nullable=True)
    rotavirus_1 = db.Column(db.Date, nullable=True)
    rotavirus_2 = db.Column(db.Date, nullable=True)
    rotavirus_3 = db.Column(db.Date, nullable=True)


class VisitMaster(db.Model):
    __tablename__ = 'visit_master'

    visit_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    record_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('medical_record.record_id', ondelete='CASCADE'),
    )
    clinic_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'),
        nullable=False,
    )
    user_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('users.user_id', ondelete='CASCADE'),
    )
    visit_number = db.Column(db.String(20), unique=True, nullable=False)
    visit_date = db.Column(db.Date, default=datetime.utcnow)
    visit_time = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)

class VisitSequence(db.Model):
    __tablename__ = 'visit_sequence'

    year = db.Column(db.Integer, primary_key=True)
    clinic_id = db.Column(UUID(as_uuid=True), db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'), primary_key=True)
    last_number = db.Column(db.Integer, nullable=False, default=0)

class VisitPregnancy(db.Model):
    __tablename__ = 'pregnancy_visit'

    visit_anc_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visit_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('visit_master.visit_id', ondelete='CASCADE'),
    )
    pr_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('pregnancy_record.pr_id', ondelete='CASCADE'),
    )
    blood_pressure = db.Column(db.String(10), nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)
    height_cm = db.Column(db.Float, nullable=True)
    body_temperature = db.Column(db.Float, nullable=True)
    respiratory_rate = db.Column(db.Float, nullable=True)
    heart_rate = db.Column(db.Float, nullable=True)
    subjective = db.Column(EncryptedText, nullable=True)
    objective = db.Column(EncryptedText, nullable=True)
    assessment = db.Column(EncryptedText, nullable=True)
    plan = db.Column(EncryptedText, nullable=True)


class VisitFamilyPlanning(db.Model):
    __tablename__ = 'kb_visit'

    visit_kb_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visit_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('visit_master.visit_id', ondelete='CASCADE'),
    )
    kb_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('kb_record.kb_id', ondelete='CASCADE'),
    )
    weight_kg = db.Column(db.Float, nullable=True)
    blood_pressure = db.Column(db.String(10), nullable=True)
    kb_method = db.Column(db.String(50), nullable=True)
    return_visit_date = db.Column(db.Date, nullable=True)
    complaint = db.Column(EncryptedText, nullable=True)


class VisitImunization(db.Model):
    __tablename__ = 'immunization_visit'

    visit_imun_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visit_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('visit_master.visit_id', ondelete='CASCADE'),
    )
    ir_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('immunization_record.ir_id', ondelete='CASCADE'),
    )
    baby_weight = db.Column(db.String(20), nullable=True)
    baby_height = db.Column(db.String(20), nullable=True)
    body_temp = db.Column(db.String(20), nullable=True)
    head_circumference = db.Column(db.String(20), nullable=True)
    abdominal_circumference = db.Column(db.String(20), nullable=True)
    dosage_given = db.Column(db.String(50), nullable=True)
    vaccine_given = db.Column(db.String(50), nullable=True)


class VisitGeneral(db.Model):
    __tablename__ = 'general_visit'

    visit_gen_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visit_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('visit_master.visit_id', ondelete='CASCADE'),
    )
    gr_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('general_record.gr_id', ondelete='CASCADE'),
    )
    subjective = db.Column(EncryptedText, nullable=True)
    objective = db.Column(EncryptedText, nullable=True)
    assessment = db.Column(EncryptedText, nullable=True)
    plan = db.Column(EncryptedText, nullable=True)


class Audit(db.Model):
    __tablename__ = 'audit'

    log_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id = db.Column(
        UUID(as_uuid=True, ondelete='CASCADE'),
        db.ForeignKey('users.user_id'),
    )
    clinic_id = db.Column(
        UUID(as_uuid=True), 
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'), 
        nullable=True,
    )
    audit_number = db.Column(db.String(50), nullable=False)
    times = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    action = db.Column(db.String(100), nullable=False)
    old_values = db.Column(JSONB, nullable=True)
    new_values = db.Column(JSONB, nullable=True)

    user = db.relationship(
        'User',
        backref=db.backref('audit_logs', cascade='all, delete-orphan'),
    )

    def __repr__(self):
        return f'<Audit {self.audit_number} - {self.action}>'
    
class AuditSequence(db.Model):
    __tablename__ = 'audit_sequence'

    year = db.Column(db.Integer, primary_key=True)
    clinic_id = db.Column(
        UUID(as_uuid=True), 
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'), 
        primary_key=True
    )
    last_number = db.Column(db.Integer, nullable=False, default=0)

class Financial(db.Model):
    __tablename__ = 'financial'

    transaction_id = db.Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visit_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('visit_master.visit_id', ondelete='CASCADE'),
        nullable=True,
    )
    clinic_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'),
        nullable=True,
    )
    user_id = db.Column(
        UUID(as_uuid=True),
        db.ForeignKey('users.user_id', ondelete='CASCADE'),
        nullable=True,
    )
    patient_id = db.Column(
        UUID(as_uuid=True, ondelete='CASCADE'),
        db.ForeignKey('patient.patient_id'),
        nullable=True,
    )
    transaction_number = db.Column(db.String(50), nullable=False)
    trans_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=True)
    payment_method = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), nullable=False)
    payment_date = db.Column(db.Date, nullable=False)
    description = db.Column(EncryptedText, nullable=True)
    
class FinancialSequence(db.Model):
    __tablename__ = 'financial_sequence'

    year = db.Column(db.Integer, primary_key=True)
    clinic_id = db.Column(
        UUID(as_uuid=True), 
        db.ForeignKey('clinic.clinic_id', ondelete='CASCADE'), 
        primary_key=True
    )
    last_number = db.Column(db.Integer, nullable=False, default=0)