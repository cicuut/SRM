from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User, Clinic
from datetime import datetime

auth_bp = Blueprint("auth", __name__)


ALLOWED_ROLES = ["owner", "admin", "midwife", "staff"]


def normalize_role(role):
    if role is None:
        return "staff"

    normalized = str(role).strip().lower()

    if normalized not in ALLOWED_ROLES:
        raise ValueError(
            f"Invalid role. Allowed roles: {', '.join(ALLOWED_ROLES)}"
        )

    return normalized


def serialize_clinic(clinic):
    if not clinic:
        return None

    return {
        "id": clinic.clinic_id,
        "clinic_name": clinic.clinic_name,
        "clinic_address": clinic.clinic_address,
        "license_number": clinic.license_number,
        "clinic_email": clinic.clinic_email,
        "clinic_phone": clinic.clinic_phone,
    }


def serialize_user(user, current_user_id=None):
    if not user:
        return None

    return {
        "id": user.user_id,
        "fullname": user.fullname,
        "email": user.email,
        "role": user.user_role,
        "strnumber": user.strnumber,
        "clinic_id": user.clinic_id,
        "is_active": bool(user.is_active),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "is_current_user": str(user.user_id) == str(current_user_id)
        if current_user_id
        else False,
    }


def serialize_account(user):
    clinic = None

    if user and user.clinic_id:
        clinic = db.session.get(Clinic, user.clinic_id)

    return {
        "user": serialize_user(user, user.user_id),
        "clinic": serialize_clinic(clinic),
    }


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_management_access():
    current_user = get_current_user()

    if not current_user:
        return None, (jsonify({"msg": "User not found"}), 404)

    if not current_user.clinic_id:
        return None, (
            jsonify({"msg": "Your account is not linked to a clinic"}),
            400,
        )

    if current_user.user_role not in ["owner", "admin"]:
        return None, (
            jsonify({"msg": "Only owner or admin can access management setting"}),
            403,
        )

    return current_user, None


def has_other_active_owner(clinic_id, exclude_user_id):
    other_owner = User.query.filter(
        User.clinic_id == clinic_id,
        User.user_id != exclude_user_id,
        User.user_role == "owner",
        User.is_active.is_(True),
    ).first()

    return other_owner is not None


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    fullname = data.get("fullname")
    email = data.get("email")
    password = data.get("password")
    strnumber = data.get("strnumber")

    if not fullname or not email or not password or not strnumber:
        return jsonify({"msg": "All data must be filled"}), 400

    email = email.strip().lower()
    fullname = fullname.strip()
    strnumber = strnumber.strip()

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email is taken"}), 409

    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg": "STR number is taken"}), 409

    try:
        new_user = User(
            fullname=fullname,
            email=email,
            strnumber=strnumber,
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
                    "user": serialize_user(new_user, new_user.user_id),
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

    if not all(
        [clinic_name, clinic_address, license_number, clinic_email, clinic_phone]
    ):
        return jsonify({"msg": "All data must be filled"}), 400

    if not user_id:
        return jsonify({"msg": "User ID is required to link the clinic!"}), 400

    user = db.session.get(User, user_id)

    if not user:
        return jsonify({"msg": "User not found in database"}), 404

    clinic_email = clinic_email.strip().lower()
    license_number = license_number.strip()

    if Clinic.query.filter_by(clinic_email=clinic_email).first():
        return jsonify({"msg": "Email is taken"}), 409

    if Clinic.query.filter_by(license_number=license_number).first():
        return jsonify({"msg": "SIPB number is taken"}), 409

    try:
        new_clinic = Clinic(
            clinic_name=clinic_name.strip(),
            clinic_address=clinic_address.strip(),
            license_number=license_number,
            clinic_email=clinic_email,
            clinic_phone=clinic_phone.strip(),
        )

        db.session.add(new_clinic)
        db.session.flush()

        user.clinic_id = new_clinic.clinic_id
        user.user_role = "owner"
        user.is_active = True

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
                    **serialize_account(user),
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

    user = User.query.filter_by(email=email.strip().lower()).first()

    if not user or not user.check_password(password):
        return jsonify({"msg": "Invalid email or password"}), 401

    if not user.is_active:
        return jsonify({"msg": "Your account is inactive"}), 403

    try:
        user.last_login = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()

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
                "user": serialize_user(user, user.user_id),
            }
        ),
        200,
    )


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user_data():
    user = get_current_user()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    return jsonify(serialize_account(user)), 200


@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_current_user():
    user = get_current_user()

    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json() or {}

    fullname = data.get("fullname")
    email = data.get("email")
    strnumber = data.get("strnumber")

    try:
        if fullname is not None:
            fullname = fullname.strip()

            if not fullname:
                return jsonify({"msg": "Full name is required"}), 400

            user.fullname = fullname

        if email is not None:
            email = email.strip().lower()

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
    user = get_current_user()

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


@auth_bp.route("/management/overview", methods=["GET"])
@jwt_required()
def get_management_overview():
    manager, error_response = require_management_access()

    if error_response:
        return error_response

    clinic = db.session.get(Clinic, manager.clinic_id)

    if not clinic:
        return jsonify({"msg": "Clinic not found"}), 404

    employees = User.query.filter_by(clinic_id=manager.clinic_id).order_by(
        User.created_at.desc()
    ).all()

    active_count = sum(1 for employee in employees if employee.is_active)
    inactive_count = len(employees) - active_count

    return (
        jsonify(
            {
                "user": serialize_user(manager, manager.user_id),
                "clinic": serialize_clinic(clinic),
                "employees": [
                    serialize_user(employee, manager.user_id)
                    for employee in employees
                ],
                "stats": {
                    "total_employees": len(employees),
                    "active_employees": active_count,
                    "inactive_employees": inactive_count,
                    "owners": sum(
                        1 for employee in employees if employee.user_role == "owner"
                    ),
                    "admins": sum(
                        1 for employee in employees if employee.user_role == "admin"
                    ),
                    "midwives": sum(
                        1 for employee in employees if employee.user_role == "midwife"
                    ),
                    "staff": sum(
                        1 for employee in employees if employee.user_role == "staff"
                    ),
                },
            }
        ),
        200,
    )


@auth_bp.route("/management/clinic", methods=["PATCH"])
@jwt_required()
def update_management_clinic():
    manager, error_response = require_management_access()

    if error_response:
        return error_response

    if manager.user_role != "owner":
        return jsonify({"msg": "Only owner can update clinic information"}), 403

    clinic = db.session.get(Clinic, manager.clinic_id)

    if not clinic:
        return jsonify({"msg": "Clinic not found"}), 404

    data = request.get_json() or {}

    clinic_name = data.get("clinic_name")
    clinic_address = data.get("clinic_address")
    license_number = data.get("license_number")
    clinic_email = data.get("clinic_email")
    clinic_phone = data.get("clinic_phone")

    try:
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
            clinic_email = clinic_email.strip().lower()

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
        db.session.refresh(clinic)

        return (
            jsonify(
                {
                    "msg": "Clinic information updated successfully",
                    "clinic": serialize_clinic(clinic),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to update clinic", "error": str(e)}), 500


@auth_bp.route("/management/employees", methods=["GET"])
@jwt_required()
def get_management_employees():
    manager, error_response = require_management_access()

    if error_response:
        return error_response

    employees = User.query.filter_by(clinic_id=manager.clinic_id).order_by(
        User.created_at.desc()
    ).all()

    return (
        jsonify(
            {
                "employees": [
                    serialize_user(employee, manager.user_id)
                    for employee in employees
                ]
            }
        ),
        200,
    )


@auth_bp.route("/management/employees/link", methods=["POST"])
@jwt_required()
def link_existing_employee():
    manager, error_response = require_management_access()

    if error_response:
        return error_response

    if manager.user_role != "owner":
        return jsonify({"msg": "Only owner can link employee accounts"}), 403

    data = request.get_json() or {}

    email = data.get("email")
    role = data.get("role", "staff")

    if not email:
        return jsonify({"msg": "Employee email is required"}), 400

    try:
        role = normalize_role(role)
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    employee = User.query.filter_by(email=email.strip().lower()).first()

    if not employee:
        return (
            jsonify(
                {
                    "msg": "Account not found. Employee must register first before being linked."
                }
            ),
            404,
        )

    if str(employee.user_id) == str(manager.user_id):
        return jsonify({"msg": "You are already linked to this clinic"}), 400

    if employee.clinic_id and str(employee.clinic_id) != str(manager.clinic_id):
        return (
            jsonify({"msg": "This account is already linked to another clinic"}),
            409,
        )

    try:
        employee.clinic_id = manager.clinic_id
        employee.user_role = role
        employee.is_active = True

        db.session.commit()
        db.session.refresh(employee)

        return (
            jsonify(
                {
                    "msg": "Employee linked successfully",
                    "employee": serialize_user(employee, manager.user_id),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to link employee", "error": str(e)}), 500


@auth_bp.route("/management/employees/<employee_id>", methods=["PATCH"])
@jwt_required()
def update_management_employee(employee_id):
    manager, error_response = require_management_access()

    if error_response:
        return error_response

    if manager.user_role != "owner":
        return jsonify({"msg": "Only owner can update employee access"}), 403

    employee = User.query.filter_by(
        user_id=str(employee_id),
        clinic_id=manager.clinic_id,
    ).first()

    if not employee:
        return jsonify({"msg": "Employee not found in this clinic"}), 404

    data = request.get_json() or {}

    role_was_changed = "role" in data
    active_was_changed = "is_active" in data

    new_role = employee.user_role
    new_is_active = employee.is_active

    if role_was_changed:
        try:
            new_role = normalize_role(data.get("role"))
        except ValueError as e:
            return jsonify({"msg": str(e)}), 400

    if active_was_changed:
        new_is_active = bool(data.get("is_active"))

    if str(employee.user_id) == str(manager.user_id):
        if role_was_changed and new_role != employee.user_role:
            return jsonify({"msg": "You cannot change your own role"}), 400

        if active_was_changed and new_is_active != employee.is_active:
            return jsonify({"msg": "You cannot deactivate your own account"}), 400

    would_remove_active_owner = (
        employee.user_role == "owner"
        and employee.is_active
        and (new_role != "owner" or new_is_active is False)
    )

    if would_remove_active_owner and not has_other_active_owner(
        manager.clinic_id, employee.user_id
    ):
        return jsonify({"msg": "At least one active owner is required"}), 400

    try:
        employee.user_role = new_role
        employee.is_active = new_is_active

        db.session.commit()
        db.session.refresh(employee)

        return (
            jsonify(
                {
                    "msg": "Employee updated successfully",
                    "employee": serialize_user(employee, manager.user_id),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to update employee", "error": str(e)}), 500


@auth_bp.route("/management/employees/<employee_id>", methods=["DELETE"])
@jwt_required()
def unlink_management_employee(employee_id):
    manager, error_response = require_management_access()

    if error_response:
        return error_response

    if manager.user_role != "owner":
        return jsonify({"msg": "Only owner can remove employee access"}), 403

    employee = User.query.filter_by(
        user_id=str(employee_id),
        clinic_id=manager.clinic_id,
    ).first()

    if not employee:
        return jsonify({"msg": "Employee not found in this clinic"}), 404

    if str(employee.user_id) == str(manager.user_id):
        return jsonify({"msg": "You cannot remove yourself from the clinic"}), 400

    would_remove_active_owner = (
        employee.user_role == "owner" and employee.is_active
    )

    if would_remove_active_owner and not has_other_active_owner(
        manager.clinic_id, employee.user_id
    ):
        return jsonify({"msg": "At least one active owner is required"}), 400

    try:
        employee.clinic_id = None
        employee.user_role = "staff"

        db.session.commit()

        return jsonify({"msg": "Employee removed from clinic successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to remove employee", "error": str(e)}), 500