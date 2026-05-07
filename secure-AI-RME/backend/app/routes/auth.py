from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User, Clinic
from datetime import datetime
from app.utils import decrypt_data, format_date
import pytz

auth_bp = Blueprint ('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    fullname = data.get('fullname')
    email = data.get('email')
    password = data.get('password')
    strnumber = data.get('strnumber')
    

    #input validation
    if not fullname or not email or not password:
        return jsonify ({"msg" : "Tanda * wajib untuk diisi!"}), 400

    #Email checking
    if User.query.filter_by(email=email).first():
        return jsonify({"msg" : "Email is taken"}), 409

    #STR checking
    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg" : "STR number is taken"}), 409
    
    try:
        #Add new user
        new_user = User(
            fullname=fullname, 
            email=email, 
            strnumber=strnumber,
            user_role='owner',
            is_active=True,
            clinic_id=None,
           
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
        db.session.refresh(new_user)
        
        additional_claims = {"clinic_id": new_user.clinic_id}
        access_token = create_access_token(identity=str(new_user.user_id), additional_claims=additional_claims)
       
        return jsonify({
            "msg": "Registration Successful",
            "access_token": access_token,
            "user_id": str(new_user.user_id)  ,
        }), 201    
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg" : "Failed to save", "error" : str(e)}), 500
    
@auth_bp.route('/register-clinic', methods=['POST'])
def createClinic():
    data = request.get_json()
    clinic_name = data.get('clinic_name')
    input_address = data.get('clinic_address', '').strip()
    input_license = data.get('license_number', '').strip()
    clinic_email = data.get('clinic_email')
    input_phone = data.get('clinic_phone', '').strip()
    user_id = data.get('user_id')
    
    if not all([clinic_name, input_license, input_address, clinic_email, input_phone]):
        return jsonify({"msg": "Semua data harus diisi"}), 400
    
     #Email checking
    if Clinic.query.filter_by(clinic_email=clinic_email).first():
        return jsonify({"msg" : "Alamat email sudah digunakan"}), 409
    
   
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User tidak ditemukan"}), 404
 
    clinics = Clinic.query.all()
    
    for clinic in clinics:
        try:
            stored_license = decrypt_data(clinic.license_number).strip()
            stored_phone = decrypt_data(clinic.clinic_phone).strip()
            stored_address = decrypt_data(clinic.clinic_address).strip()
            
            if stored_license == input_license:
                return jsonify({"msg": "Nomor SIPB sudah digunakan"}), 409
            
            if stored_phone == input_phone:
                return jsonify({"msg": "Nomor ponsel sudah digunakan"}), 409
            
            if stores_address == input_address:
                return jsonify({"msg": "Alamat sudah digunakan"}), 409
        
        except Exception:
            continue    
    
    try:
        new_clinic = Clinic(
            clinic_name=clinic_name,
            clinic_address=input_address,
            license_number=input_license,
            clinic_email=clinic_email,
            clinic_phone=input_phone
        )
        
        db.session.add(new_clinic)
        db.session.flush()
        
        user = User.query.get(user_id)
        if user:
            user.clinic_id = new_clinic.clinic_id 
            db.session.commit()
            return jsonify({"msg": "Data klinik sudah tersimpan"}), 201
        
        return jsonify({"msg": "User not found"}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg" : "Gagal untuk menyimpan", "error" : str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    #input validation
    if not email or not password:
        return jsonify({"msg" : "email and password are required"}), 404
    
    #checking user
    user = User.query.filter_by(email=email).first()
    
    #checking user crendential
    if user and user.check_password(password):
        additional_claims = {"clinic_id": user.clinic_id}
        access_token = create_access_token(identity=str(user.user_id), additional_claims=additional_claims)
        
        user.last_login = datetime.now()
        db.session.commit()
        
        return jsonify({
            "msg": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user.user_id,
                "fullname": user.fullname,
                "role": user.user_role,
                "clinic_id": user.clinic_id,
                "last_login": user.last_login.strftime('%Y-%m-%d %H:%M:%S')
            }
        }), 200

    return jsonify({"msg": "Invalid email or password"}), 401


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return (
        jsonify(
            {
                "user": {
                    "id": user.user_id,
                    "fullname": user.fullname,
                    "role": user.user_role,
                    "clinic_id": user.clinic_id,
                    "email": user.email,
                }
            }
        ),
        200,
    )
