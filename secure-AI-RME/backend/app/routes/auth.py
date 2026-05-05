from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User, Clinic
from datetime import datetime

auth_bp = Blueprint("auth", __name__)

ALLOWED_ROLES = ["admin", "midwife", "asisten"]
ADMIN_ROLE = "admin"


def to_str(value):
    if value is None:
        return None

    return str(value)


def normalize_role(role):
    normalized = str(role or "asisten").strip().lower()

    if normalized == "assistant":
        normalized = "asisten"

    if normalized == "staff":
        normalized = "asisten"

    if normalized == "owner":
        normalized = "admin"

    if normalized not in ALLOWED_ROLES:
        raise ValueError(
            f"Invalid role. Allowed roles: {', '.join(ALLOWED_ROLES)}"
        )

    return normalized


def create_token_for_user(user):
    return create_access_token(
        identity=str(user.user_id),
        additional_claims={
            "clinic_id": to_str(user.clinic_id),
            "role": user.user_role,
        },
    )


def serialize_clinic(clinic):
    if not clinic:
        return None

    return {
        "id": to_str(clinic.clinic_id),
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
        "id": to_str(user.user_id),
        "fullname": user.fullname,
        "email": user.email,
        "role": user.user_role,
        "strnumber": user.strnumber,
        "clinic_id": to_str(user.clinic_id),
        "is_active": bool(user.is_active),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "is_current_user": str(user.user_id) == str(current_user_id)
        if current_user_id
        else False,
    }


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def serialize_account(user):
    clinic = None

    if user and user.clinic_id:
        clinic = db.session.get(Clinic, user.clinic_id)

    return {
        "user": serialize_user(user, user.user_id if user else None),
        "clinic": serialize_clinic(clinic),
    }


def require_login():
    user = get_current_user()

    if not user:
        return None, (jsonify({"msg": "User not found"}), 404)

    if not user.is_active:
        return None, (jsonify({"msg": "Your account is inactive"}), 403)

    return user, None


def require_admin(require_clinic=True):
    user, error_response = require_login()

    if error_response:
        return None, error_response

    if user.user_role != ADMIN_ROLE:
        return None, (jsonify({"msg": "Only admin can access this feature"}), 403)

    if require_clinic and not user.clinic_id:
        return None, (
            jsonify(
                {
                    "msg": "Admin account is not linked to a clinic",
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                }
            ),
            400,
        )

    return user, None


def has_other_active_admin(clinic_id, exclude_user_id):
    other_admin = User.query.filter(
        User.clinic_id == clinic_id,
        User.user_id != exclude_user_id,
        User.user_role == ADMIN_ROLE,
        User.is_active.is_(True),
    ).first()

    return other_admin is not None


def get_user_by_email(email):
    return User.query.filter_by(email=email.strip().lower()).first()


@auth_bp.route("/roles", methods=["GET"])
def get_roles():
    return jsonify({"roles": ALLOWED_ROLES}), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register publik hanya untuk membuat admin pertama saat database users masih kosong.
    Setelah ada user pertama, akun baru harus dibuat oleh admin dari Management Setting.
    """

    existing_user = User.query.first()

    if existing_user:
        return (
            jsonify(
                {
                    "msg": "Public registration is disabled. Please ask admin to create your account from Management Setting."
                }
            ),
            403,
        )

    data = request.get_json() or {}

    fullname = (data.get("fullname") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    strnumber = (data.get("strnumber") or "").strip()

    if not fullname or not email or not password or not strnumber:
        return jsonify({"msg": "Full name, email, password, and STR number are required"}), 400

    if len(password) < 8:
        return jsonify({"msg": "Password must be at least 8 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email is taken"}), 409

    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg": "STR number is taken"}), 409

    try:
        new_user = User(
            fullname=fullname,
            email=email,
            strnumber=strnumber,
            user_role=ADMIN_ROLE,
            is_active=True,
            clinic_id=None,
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
        db.session.refresh(new_user)

        return (
            jsonify(
                {
                    "msg": "First admin account created successfully. Please set up clinic information.",
                    "access_token": create_token_for_user(new_user),
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                    "user": serialize_user(new_user, new_user.user_id),
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to create first admin", "error": str(e)}), 500


@auth_bp.route("/register-clinic", methods=["POST"])
@jwt_required()
def create_or_update_clinic():
    admin, error_response = require_admin(require_clinic=False)

    if error_response:
        return error_response

    data = request.get_json() or {}

    clinic_name = (data.get("clinic_name") or "").strip()
    clinic_address = (data.get("clinic_address") or "").strip()
    license_number = (data.get("license_number") or "").strip()
    clinic_email = (data.get("clinic_email") or "").strip().lower()
    clinic_phone = (data.get("clinic_phone") or "").strip()

    if not all([clinic_name, clinic_address, license_number, clinic_email, clinic_phone]):
        return jsonify({"msg": "All clinic data must be filled"}), 400

    try:
        existing_clinic_email = Clinic.query.filter(
            Clinic.clinic_email == clinic_email,
            Clinic.clinic_id != admin.clinic_id,
        ).first()

        if existing_clinic_email:
            return jsonify({"msg": "Clinic email is taken"}), 409

        existing_license = Clinic.query.filter(
            Clinic.license_number == license_number,
            Clinic.clinic_id != admin.clinic_id,
        ).first()

        if existing_license:
            return jsonify({"msg": "SIPB number is taken"}), 409

        if admin.clinic_id:
            clinic = db.session.get(Clinic, admin.clinic_id)

            if not clinic:
                return jsonify({"msg": "Clinic not found"}), 404

            clinic.clinic_name = clinic_name
            clinic.clinic_address = clinic_address
            clinic.license_number = license_number
            clinic.clinic_email = clinic_email
            clinic.clinic_phone = clinic_phone

        else:
            clinic = Clinic(
                clinic_name=clinic_name,
                clinic_address=clinic_address,
                license_number=license_number,
                clinic_email=clinic_email,
                clinic_phone=clinic_phone,
            )

            db.session.add(clinic)
            db.session.flush()

            admin.clinic_id = clinic.clinic_id
            admin.user_role = ADMIN_ROLE
            admin.is_active = True

        db.session.commit()
        db.session.refresh(admin)

        return (
            jsonify(
                {
                    "msg": "Clinic information saved successfully",
                    "access_token": create_token_for_user(admin),
                    "requires_clinic_setup": False,
                    "redirect_path": "/dashboard",
                    **serialize_account(admin),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to save clinic", "error": str(e)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"msg": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"msg": "Invalid email or password"}), 401

    if not user.is_active:
        return jsonify({"msg": "Your account is inactive"}), 403

    try:
        user.last_login = datetime.utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()

    requires_clinic_setup = user.user_role == ADMIN_ROLE and not user.clinic_id

    return (
        jsonify(
            {
                "msg": "Login successful",
                "access_token": create_token_for_user(user),
                "requires_clinic_setup": requires_clinic_setup,
                "redirect_path": "/register-clinic"
                if requires_clinic_setup
                else "/dashboard",
                "user": serialize_user(user, user.user_id),
            }
        ),
        200,
    )


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user_data():
    user, error_response = require_login()

    if error_response:
        return error_response

    return jsonify(serialize_account(user)), 200


@auth_bp.route("/me", methods=["PATCH"])
@jwt_required()
def update_current_user():
    user, error_response = require_login()

    if error_response:
        return error_response

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
    user, error_response = require_login()

    if error_response:
        return error_response

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

    if current_password == new_password:
        return jsonify({"msg": "New password cannot be the same as current password"}), 400

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
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    clinic = db.session.get(Clinic, admin.clinic_id)

    if not clinic:
        return jsonify({"msg": "Clinic not found"}), 404

    employees = User.query.filter_by(clinic_id=admin.clinic_id).order_by(
        User.created_at.desc()
    ).all()

    active_count = sum(1 for employee in employees if employee.is_active)
    inactive_count = len(employees) - active_count

    return (
        jsonify(
            {
                "user": serialize_user(admin, admin.user_id),
                "clinic": serialize_clinic(clinic),
                "employees": [
                    serialize_user(employee, admin.user_id) for employee in employees
                ],
                "stats": {
                    "total_employees": len(employees),
                    "active_employees": active_count,
                    "inactive_employees": inactive_count,
                    "admins": sum(
                        1 for employee in employees if employee.user_role == "admin"
                    ),
                    "midwives": sum(
                        1 for employee in employees if employee.user_role == "midwife"
                    ),
                    "asistens": sum(
                        1 for employee in employees if employee.user_role == "asisten"
                    ),
                },
                "roles": ALLOWED_ROLES,
            }
        ),
        200,
    )


@auth_bp.route("/management/clinic", methods=["PATCH"])
@jwt_required()
def update_management_clinic():
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    clinic = db.session.get(Clinic, admin.clinic_id)

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

        if not all(
            [
                clinic.clinic_name,
                clinic.clinic_address,
                clinic.license_number,
                clinic.clinic_email,
                clinic.clinic_phone,
            ]
        ):
            return jsonify({"msg": "All clinic data must be filled"}), 400

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


@auth_bp.route("/management/users", methods=["POST"])
@jwt_required()
def create_management_user():
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    data = request.get_json() or {}

    fullname = (data.get("fullname") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    strnumber = (data.get("strnumber") or "").strip()
    is_active = bool(data.get("is_active", True))

    try:
        role = normalize_role(data.get("role", "asisten"))
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    if not fullname or not email or not password or not strnumber:
        return jsonify({"msg": "Full name, email, password, and STR number are required"}), 400

    if len(password) < 8:
        return jsonify({"msg": "Password must be at least 8 characters"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email is taken"}), 409

    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg": "STR number is taken"}), 409

    try:
        new_user = User(
            clinic_id=admin.clinic_id,
            fullname=fullname,
            email=email,
            strnumber=strnumber,
            user_role=role,
            is_active=is_active,
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()
        db.session.refresh(new_user)

        return (
            jsonify(
                {
                    "msg": "User account created successfully",
                    "employee": serialize_user(new_user, admin.user_id),
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to create user account", "error": str(e)}), 500


@auth_bp.route("/management/employees", methods=["GET"])
@jwt_required()
def get_management_employees():
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    employees = User.query.filter_by(clinic_id=admin.clinic_id).order_by(
        User.created_at.desc()
    ).all()

    return (
        jsonify(
            {
                "employees": [
                    serialize_user(employee, admin.user_id) for employee in employees
                ]
            }
        ),
        200,
    )


@auth_bp.route("/management/employees/<employee_id>", methods=["PATCH"])
@jwt_required()
def update_management_employee(employee_id):
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    employee = User.query.filter_by(
        user_id=str(employee_id),
        clinic_id=admin.clinic_id,
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

    if str(employee.user_id) == str(admin.user_id):
        if role_was_changed and new_role != employee.user_role:
            return jsonify({"msg": "You cannot change your own role"}), 400

        if active_was_changed and new_is_active != employee.is_active:
            return jsonify({"msg": "You cannot deactivate your own account"}), 400

    would_remove_active_admin = (
        employee.user_role == ADMIN_ROLE
        and employee.is_active
        and (new_role != ADMIN_ROLE or new_is_active is False)
    )

    if would_remove_active_admin and not has_other_active_admin(
        admin.clinic_id,
        employee.user_id,
    ):
        return jsonify({"msg": "At least one active admin is required"}), 400

    try:
        employee.user_role = new_role
        employee.is_active = new_is_active

        db.session.commit()
        db.session.refresh(employee)

        return (
            jsonify(
                {
                    "msg": "Employee updated successfully",
                    "employee": serialize_user(employee, admin.user_id),
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
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    employee = User.query.filter_by(
        user_id=str(employee_id),
        clinic_id=admin.clinic_id,
    ).first()

    if not employee:
        return jsonify({"msg": "Employee not found in this clinic"}), 404

    if str(employee.user_id) == str(admin.user_id):
        return jsonify({"msg": "You cannot remove yourself from the clinic"}), 400

    would_remove_active_admin = (
        employee.user_role == ADMIN_ROLE and employee.is_active
    )

    if would_remove_active_admin and not has_other_active_admin(
        admin.clinic_id,
        employee.user_id,
    ):
        return jsonify({"msg": "At least one active admin is required"}), 400

    try:
        employee.clinic_id = None
        employee.user_role = "asisten"
        employee.is_active = False

        db.session.commit()

        return jsonify({"msg": "Employee removed from clinic successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Failed to remove employee", "error": str(e)}), 500