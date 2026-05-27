from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User, Clinic
from app.utils import write_audit_log
from datetime import datetime


auth_bp = Blueprint("auth", __name__)

ALLOWED_ROLES = ["admin", "midwife", "asisten"]
ADMIN_ROLE = "admin"

PROFILE_PHOTO_MAX_LENGTH = 3_500_000


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


def parse_bool(value, default=True):
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in ["true", "1", "yes", "active"]:
            return True

        if normalized in ["false", "0", "no", "inactive"]:
            return False

    return bool(value)


def normalize_profile_photo(value):
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValueError("Profile photo must be a string")

    photo = value.strip()

    if photo == "":
        return None

    if len(photo) > PROFILE_PHOTO_MAX_LENGTH:
        raise ValueError("Profile photo is too large. Maximum size is around 2MB image file.")

    if photo.startswith("data:image/"):
        return photo

    if photo.startswith("http://") or photo.startswith("https://"):
        return photo

    raise ValueError("Profile photo must be an image data URL or image URL")


def user_has_profile_photo_column(user):
    return hasattr(user, "profile_photo")


def get_user_profile_photo(user):
    if not user:
        return None

    if not user_has_profile_photo_column(user):
        return None

    return getattr(user, "profile_photo", None)


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
        "user_role": user.user_role,
        "strnumber": user.strnumber,
        "clinic_id": to_str(user.clinic_id),
        "is_active": bool(user.is_active),
        "profile_photo": get_user_profile_photo(user),
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


def clinic_old_values(clinic):
    if not clinic:
        return {}

    return {
        "module": "Clinic",
        "clinic_id": to_str(clinic.clinic_id),
        "clinic_name": clinic.clinic_name,
        "clinic_address": clinic.clinic_address,
        "license_number": clinic.license_number,
        "clinic_email": clinic.clinic_email,
        "clinic_phone": clinic.clinic_phone,
    }


def user_old_values(user, module="User Access"):
    if not user:
        return {}

    return {
        "module": module,
        "user_id": to_str(user.user_id),
        "clinic_id": to_str(user.clinic_id),
        "fullname": user.fullname,
        "email": user.email,
        "role": user.user_role,
        "strnumber": user.strnumber,
        "is_active": bool(user.is_active),
        "profile_photo_present": bool(get_user_profile_photo(user)),
    }


def get_management_payload(admin):
    clinic = db.session.get(Clinic, admin.clinic_id)

    if not clinic:
        return None

    employees = User.query.filter(
        User.clinic_id == admin.clinic_id
    ).order_by(User.created_at.desc()).all()

    active_count = sum(1 for employee in employees if employee.is_active)
    inactive_count = len(employees) - active_count

    return {
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


@auth_bp.route("/roles", methods=["GET"])
def get_roles():
    return jsonify({"roles": ALLOWED_ROLES}), 200


@auth_bp.route("/register", methods=["POST"])
def register():
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
        db.session.flush()

        write_audit_log(
            user_id=new_user.user_id,
            action="REGISTER_FIRST_ADMIN",
            old_values={},
            new_values={
                "module": "Authentication",
                "user_id": to_str(new_user.user_id),
                "fullname": new_user.fullname,
                "email": new_user.email,
                "role": new_user.user_role,
                "strnumber": new_user.strnumber,
                "is_active": bool(new_user.is_active),
                "profile_photo_present": bool(get_user_profile_photo(new_user)),
            },
        )

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
        return jsonify({"msg": f"Failed to create first admin: {str(e)}"}), 500


@auth_bp.route("/register-clinic", methods=["POST"])
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

            old_values = clinic_old_values(clinic)
            action_name = "UPDATE_CLINIC"

            clinic.clinic_name = clinic_name
            clinic.clinic_address = clinic_address
            clinic.license_number = license_number
            clinic.clinic_email = clinic_email
            clinic.clinic_phone = clinic_phone

        else:
            old_values = {}
            action_name = "CREATE_CLINIC"

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

        write_audit_log(
            user_id=admin.user_id,
            action=action_name,
            old_values=old_values,
            new_values=clinic_old_values(clinic),
        )

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
        return jsonify({"msg": f"Failed to save clinic: {str(e)}"}), 500


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
        old_values = {
            "module": "Authentication",
            "user_id": to_str(user.user_id),
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }

        user.last_login = datetime.utcnow()

        write_audit_log(
            user_id=user.user_id,
            action="LOGIN",
            old_values=old_values,
            new_values={
                "module": "Authentication",
                "user_id": to_str(user.user_id),
                "fullname": user.fullname,
                "email": user.email,
                "role": user.user_role,
                "last_login": user.last_login.isoformat(),
                "profile_photo_present": bool(get_user_profile_photo(user)),
            },
        )

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
    profile_photo_was_provided = "profile_photo" in data

    try:
        old_values = user_old_values(user, module="Account Setting")

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

        if profile_photo_was_provided:
            if not user_has_profile_photo_column(user):
                return (
                    jsonify(
                        {
                            "msg": "Column profile_photo belum ada di model User. Tambahkan profile_photo = db.Column(db.Text, nullable=True) di app/models.py dan jalankan ALTER TABLE users ADD COLUMN profile_photo TEXT."
                        }
                    ),
                    400,
                )

            normalized_photo = normalize_profile_photo(data.get("profile_photo"))
            user.profile_photo = normalized_photo

        action_name = (
            "UPDATE_PROFILE_PHOTO"
            if profile_photo_was_provided
            and fullname is None
            and email is None
            and strnumber is None
            else "UPDATE_ACCOUNT_PROFILE"
        )

        new_values = user_old_values(user, module="Account Setting")

        if profile_photo_was_provided:
            new_values["profile_photo_updated"] = True

        write_audit_log(
            user_id=user.user_id,
            action=action_name,
            old_values=old_values,
            new_values=new_values,
        )

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

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Failed to update account: {str(e)}"}), 500


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

        write_audit_log(
            user_id=user.user_id,
            action="CHANGE_PASSWORD",
            old_values={
                "module": "Account Setting",
                "user_id": to_str(user.user_id),
                "password_changed": False,
            },
            new_values={
                "module": "Account Setting",
                "user_id": to_str(user.user_id),
                "password_changed": True,
            },
        )

        db.session.commit()

        return jsonify({"msg": "Password changed successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Failed to change password: {str(e)}"}), 500


@auth_bp.route("/management/overview", methods=["GET"])
@jwt_required()
def get_management_overview():
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    payload = get_management_payload(admin)

    if not payload:
        return jsonify({"msg": "Clinic not found"}), 404

    return jsonify(payload), 200


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
        old_values = clinic_old_values(clinic)

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

        write_audit_log(
            user_id=admin.user_id,
            action="UPDATE_CLINIC",
            old_values=old_values,
            new_values=clinic_old_values(clinic),
        )

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
        return jsonify({"msg": f"Failed to update clinic: {str(e)}"}), 500


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
    is_active = parse_bool(data.get("is_active", True), default=True)

    try:
        role = normalize_role(data.get("role", "asisten"))
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    if not fullname or not email or not password or not strnumber:
        return jsonify({"msg": "Full name, email, password, and STR number are required"}), 400

    if len(password) < 8:
        return jsonify({"msg": "Password must be at least 8 characters"}), 400

    existing_user_by_email = User.query.filter_by(email=email).first()
    existing_user_by_strnumber = User.query.filter_by(strnumber=strnumber).first()

    if existing_user_by_strnumber and (
        not existing_user_by_email
        or str(existing_user_by_strnumber.user_id) != str(existing_user_by_email.user_id)
    ):
        return jsonify({"msg": "STR number is already used by another account"}), 409

    try:
        if existing_user_by_email:
            old_values = user_old_values(existing_user_by_email, module="User Access")

            if existing_user_by_email.clinic_id == admin.clinic_id and existing_user_by_email.is_active:
                return jsonify({"msg": "Email is already active in this clinic"}), 409

            if existing_user_by_email.clinic_id and existing_user_by_email.clinic_id != admin.clinic_id:
                return jsonify({"msg": "Email is already used by another clinic"}), 409

            existing_user_by_email.fullname = fullname
            existing_user_by_email.strnumber = strnumber
            existing_user_by_email.user_role = role
            existing_user_by_email.clinic_id = admin.clinic_id
            existing_user_by_email.is_active = is_active
            existing_user_by_email.set_password(password)

            db.session.flush()

            write_audit_log(
                user_id=admin.user_id,
                action="REACTIVATE_ACCOUNT",
                old_values=old_values,
                new_values={
                    **user_old_values(existing_user_by_email, module="User Access"),
                    "reactivated": True,
                },
            )

            db.session.commit()
            db.session.refresh(existing_user_by_email)

            return (
                jsonify(
                    {
                        "msg": "User account reactivated successfully",
                        "employee": serialize_user(existing_user_by_email, admin.user_id),
                    }
                ),
                200,
            )

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
        db.session.flush()

        write_audit_log(
            user_id=admin.user_id,
            action="ADD_ACCOUNT",
            old_values={},
            new_values=user_old_values(new_user, module="User Access"),
        )

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
        return jsonify({"msg": f"Failed to create user account: {str(e)}"}), 500


@auth_bp.route("/management/employees", methods=["GET"])
@jwt_required()
def get_management_employees():
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    employees = User.query.filter(
        User.clinic_id == admin.clinic_id
    ).order_by(User.created_at.desc()).all()

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

    employee = User.query.filter(
        User.user_id == str(employee_id),
        User.clinic_id == admin.clinic_id,
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
        new_is_active = parse_bool(data.get("is_active"), default=employee.is_active)

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
        old_values = user_old_values(employee, module="User Access")

        employee.user_role = new_role
        employee.is_active = new_is_active

        write_audit_log(
            user_id=admin.user_id,
            action="UPDATE_USER_ACCESS",
            old_values=old_values,
            new_values=user_old_values(employee, module="User Access"),
        )

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
        return jsonify({"msg": f"Failed to update employee: {str(e)}"}), 500


@auth_bp.route("/management/employees/<employee_id>", methods=["DELETE"])
@jwt_required()
def unlink_management_employee(employee_id):
    admin, error_response = require_admin(require_clinic=True)

    if error_response:
        return error_response

    employee = User.query.filter(
        User.user_id == str(employee_id),
        User.clinic_id == admin.clinic_id,
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
        old_values = user_old_values(employee, module="User Access")

        employee.clinic_id = None
        employee.is_active = False

        db.session.flush()

        write_audit_log(
            user_id=admin.user_id,
            action="REMOVE_USER_FROM_CLINIC",
            old_values=old_values,
            new_values={
                **user_old_values(employee, module="User Access"),
                "removed_from_clinic": True,
            },
        )

        db.session.commit()

        return (
            jsonify(
                {
                    "msg": "Employee removed from clinic successfully",
                    "removed_employee_id": str(employee_id),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Failed to remove employee: {str(e)}"}), 500