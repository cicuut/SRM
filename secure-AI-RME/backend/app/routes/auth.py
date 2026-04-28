from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User, Clinic
from datetime import datetime

auth_bp = Blueprint ('auth', __name__)

def serialize_account(user):
    clinic = None

    if user.clinic_id:
        clinic = db.session.get(Clinic, user.clinic_id)

    return {
        "user": {
            "id": user.user_id,
            "fullname": user.fullname,
            "email": user.email,
            "role": user.user_role,
            "strnumber": user.strnumber,
            "clinic_id": user.clinic_id,
        },
        "clinic": {
            "id": clinic.clinic_id,
            "clinic_name": clinic.clinic_name,
            "clinic_address": clinic.clinic_address,
            "license_number": clinic.license_number,
            "clinic_email": clinic.clinic_email,
            "clinic_phone": clinic.clinic_phone,
        }
        if clinic
        else None,
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    fullname = data.get("fullname")
    email = data.get("email")
    password = data.get("password")
    strnumber = data.get("strnumber")

    if not fullname or not email or not password or not strnumber:
        return jsonify({"msg": "All data must be filled"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email is taken"}), 409

    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg": "STR number is taken"}), 409

    try:
        new_user = User(
            fullname=fullname.strip(),
            email=email.strip(),
            strnumber=strnumber.strip(),
            user_role="owner",
            is_active=True,
            clinic_id=None,
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
        db.session.refresh(new_user)

        additional_claims = {"clinic_id": new_user.clinic_id}
        access_token = create_access_token(
            identity=str(new_user.user_id),
            additional_claims=additional_claims,
        )

        return (
            jsonify(
                {
                    "msg": "Registration Successful",
                    "access_token": access_token,
                    "user_id": str(new_user.user_id),
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to save", "error": str(e)}), 500


@auth_bp.route("/register-clinic", methods=["POST"])
def createClinic():
    data = request.get_json() or {}

    clinic_name = data.get("clinic_name")
    clinic_address = data.get("clinic_address")
    license_number = data.get("license_number")
    clinic_email = data.get("clinic_email")
    clinic_phone = data.get("clinic_phone")
    user_id = data.get("user_id")

    if not all([clinic_name, clinic_address, license_number, clinic_email, clinic_phone]):
        return jsonify({"msg": "All data must be filled"}), 400

    if not user_id:
        return jsonify({"msg": "User ID is required to link the clinic!"}), 400

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"msg": "User not found in database"}), 404

    if Clinic.query.filter_by(clinic_email=clinic_email).first():
        return jsonify({"msg": "Email is taken"}), 409

    if Clinic.query.filter_by(license_number=license_number).first():
        return jsonify({"msg": "SIPB number is taken"}), 409

    try:
        new_clinic = Clinic(
            clinic_name=clinic_name.strip(),
            clinic_address=clinic_address.strip(),
            license_number=license_number.strip(),
            clinic_email=clinic_email.strip(),
            clinic_phone=clinic_phone.strip(),
        )

        db.session.add(new_clinic)
        db.session.flush()

        user.clinic_id = new_clinic.clinic_id
        db.session.commit()
        db.session.refresh(user)

        additional_claims = {"clinic_id": user.clinic_id}
        access_token = create_access_token(
            identity=str(user.user_id),
            additional_claims=additional_claims,
        )

        return (
            jsonify(
                {
                    "msg": "Clinic data successfully saved and linked to user",
                    "access_token": access_token,
                    "clinic_id": user.clinic_id,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to save", "error": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"msg": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if user and user.check_password(password):
        additional_claims = {"clinic_id": user.clinic_id}
        access_token = create_access_token(
            identity=str(user.user_id),
            additional_claims=additional_claims,
        )

        return (
            jsonify(
                {
                    "msg": "Login successful",
                    "access_token": access_token,
                    "user": {
                        "id": user.user_id,
                        "fullname": user.fullname,
                        "email": user.email,
                        "role": user.user_role,
                        "clinic_id": user.clinic_id,
                        "strnumber": user.strnumber,
                    },
                }
            ),
            200,
        )

    return jsonify({"msg": "Invalid email or password"}), 401


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    return jsonify(serialize_account(user)), 200


@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_current_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}

    fullname = data.get("fullname")
    email = data.get("email")
    strnumber = data.get("strnumber")
    clinic_data = data.get("clinic") or {}

    try:
        if fullname is not None:
            fullname = fullname.strip()
            if not fullname:
                return jsonify({"msg": "Full name is required"}), 400
            user.fullname = fullname

        if email is not None:
            email = email.strip()
            if not email:
                return jsonify({"msg": "Email is required"}), 400

            existing_email = User.query.filter(
                User.email == email,
                User.user_id != user.user_id,
            ).first()

            if existing_email:
                return jsonify({"msg": "Email is taken"}), 409

            user.email = email

        if strnumber is not None:
            strnumber = strnumber.strip()
            if not strnumber:
                return jsonify({"msg": "STR number is required"}), 400

            existing_str = User.query.filter(
                User.strnumber == strnumber,
                User.user_id != user.user_id,
            ).first()

            if existing_str:
                return jsonify({"msg": "STR number is taken"}), 409

            user.strnumber = strnumber

        if clinic_data:
            if not isinstance(clinic_data, dict):
                return jsonify({"msg": "Clinic data must be an object"}), 400

            if not user.clinic_id:
                return jsonify({"msg": "Clinic is not linked to this user"}), 404

            clinic = db.session.get(Clinic, user.clinic_id)

            if not clinic:
                return jsonify({"msg": "Clinic not found"}), 404

            clinic_name = clinic_data.get("clinic_name")
            clinic_address = clinic_data.get("clinic_address")
            license_number = clinic_data.get("license_number")
            clinic_email = clinic_data.get("clinic_email")
            clinic_phone = clinic_data.get("clinic_phone")

            if clinic_name is not None:
                clinic_name = clinic_name.strip()
                if not clinic_name:
                    return jsonify({"msg": "Clinic name is required"}), 400
                clinic.clinic_name = clinic_name

            if clinic_address is not None:
                clinic_address = clinic_address.strip()
                if not clinic_address:
                    return jsonify({"msg": "Clinic address is required"}), 400
                clinic.clinic_address = clinic_address

            if license_number is not None:
                license_number = license_number.strip()
                if not license_number:
                    return jsonify({"msg": "SIPB number is required"}), 400

                existing_license = Clinic.query.filter(
                    Clinic.license_number == license_number,
                    Clinic.clinic_id != clinic.clinic_id,
                ).first()

                if existing_license:
                    return jsonify({"msg": "SIPB number is taken"}), 409

                clinic.license_number = license_number

            if clinic_email is not None:
                clinic_email = clinic_email.strip()
                if not clinic_email:
                    return jsonify({"msg": "Clinic email is required"}), 400

                existing_clinic_email = Clinic.query.filter(
                    Clinic.clinic_email == clinic_email,
                    Clinic.clinic_id != clinic.clinic_id,
                ).first()

                if existing_clinic_email:
                    return jsonify({"msg": "Clinic email is taken"}), 409

                clinic.clinic_email = clinic_email

            if clinic_phone is not None:
                clinic_phone = clinic_phone.strip()
                if not clinic_phone:
                    return jsonify({"msg": "Clinic phone is required"}), 400
                clinic.clinic_phone = clinic_phone

        db.session.commit()
        db.session.refresh(user)

        return (
            jsonify(
                {
                    "msg": "Account updated successfully",
                    **serialize_account(user),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to update account", "error": str(e)}), 500


@auth_bp.route("/change-password", methods=["PATCH"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}

    current_password = data.get("current_password")
    new_password = data.get("new_password")
    confirm_new_password = data.get("confirm_new_password")

    if not current_password or not new_password or not confirm_new_password:
        return jsonify({"msg": "All password fields must be filled"}), 400

    if new_password != confirm_new_password:
        return jsonify({"msg": "New password confirmation does not match"}), 400

    if len(new_password) < 8:
        return jsonify({"msg": "New password must be at least 8 characters"}), 400

    if not user.check_password(current_password):
        return jsonify({"msg": "Current password is incorrect"}), 401

    try:
        user.set_password(new_password)
        db.session.commit()

        return jsonify({"msg": "Password changed successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to change password", "error": str(e)}), 500
