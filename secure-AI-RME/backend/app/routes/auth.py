from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from app.models import db, User, Clinic
from datetime import datetime

auth_bp = Blueprint ('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    fullname = data.get('fullname')
    email = data.get('email')
    password = data.get('password')
    strnumber = data.get('strnumber')

    #input validation
    if not fullname or not email or not password or not strnumber:
        return jsonify ({"msg" : "All data must be filled"}), 400

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
            clinic_id=None
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
        db.session.refresh(new_user)
        
        access_token = create_access_token(identity=str(new_user.user_id))
       
        return jsonify({
            "msg": "Registration Successful",
            "access_token": access_token,
            "user_id": str(new_user.user_id)  
        }), 201    
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg" : "Failed to save", "error" : str(e)}), 500
    
@auth_bp.route('/register-clinic', methods=['POST'])
def createClinic():
    data = request.get_json()
    clinic_name = data.get('clinic_name')
    clinic_address = data.get('clinic_address')
    license_number = data.get('license_number')
    clinic_email = data.get('clinic_email')
    clinic_phone = data.get('clinic_phone')
    user_id = data.get('user_id')
    
    if not all([clinic_name, clinic_address, license_number, clinic_email, clinic_phone]):
        return jsonify({"msg": "All data must be filled"}), 400
    
    #User checking
    if not user_id:
        return jsonify({"msg": "User ID is required to link the clinic!"}), 400
    
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"msg": "User not found in database"}), 404
    
    #Email checking
    if Clinic.query.filter_by(clinic_email=clinic_email).first():
        return jsonify({"msg" : "Email is taken"}), 409

    #SIPB checking
    if Clinic.query.filter_by( license_number=license_number).first():
        return jsonify({"msg" : "SIPB number is taken"}), 409
    
    try:
        new_clinic = Clinic(
            clinic_name=clinic_name,
            clinic_address=clinic_address,
            license_number=license_number,
            clinic_email=clinic_email,
            clinic_phone=clinic_phone
        )
        
        db.session.add(new_clinic)
        db.session.flush()
        
        user = User.query.get(user_id)
        if user:
            user.clinic_id = new_clinic.clinic_id 
            db.session.commit()
            return jsonify({"msg": "Clinic data successfully saved and linked to user"}), 201
        
        return jsonify({"msg": "User not found"}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg" : "Failed to save", "error" : str(e)}), 500

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
        access_token = create_access_token(identity=str(user.user_id))
        
        return jsonify({
            "msg": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user.user_id,
                "fullname": user.fullname,
                "role": user.user_role,
                "clinic_id": user.clinic_id
            }
        }), 200

    return jsonify({"msg": "Invalid email or password"}), 401
    