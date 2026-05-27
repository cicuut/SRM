from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models import db, User, Clinic
from app.utils import write_audit_log
from datetime import datetime


auth_bp = Blueprint("auth", __name__)

ADMIN_ROLE = "admin"
MIDWIFE_ROLE = "midwife"
ASSISTANT_ROLE = "asisten"

ALLOWED_ROLES = [ADMIN_ROLE, MIDWIFE_ROLE, ASSISTANT_ROLE]
MANAGEMENT_ROLES = [ADMIN_ROLE, MIDWIFE_ROLE]
CLINIC_SETUP_ROLES = [MIDWIFE_ROLE]

PROFILE_PHOTO_MAX_LENGTH = 3_500_000


def to_str(value):
    if value is None:
        return None

    return str(value)


def normalize_role(role):
    normalized = str(role or ASSISTANT_ROLE).strip().lower()

    role_aliases = {
        "admin": ADMIN_ROLE,
        "developer": ADMIN_ROLE,
        "midwife": MIDWIFE_ROLE,
        "bidan": MIDWIFE_ROLE,
        "owner": MIDWIFE_ROLE,
        "asisten": ASSISTANT_ROLE,
        "assistant": ASSISTANT_ROLE,
        "staff": ASSISTANT_ROLE,
    }

    normalized = role_aliases.get(normalized, normalized)

    if normalized not in ALLOWED_ROLES:
        raise ValueError(
            "Role tidak valid. Role yang tersedia: admin, midwife, asisten."
        )

    return normalized


def role_to_text(role):
    try:
        return normalize_role(role)
    except Exception:
        return str(role or "").strip().lower()


def requires_clinic_setup_for_user(user):
    if not user:
        return False

    return role_to_text(user.user_role) in CLINIC_SETUP_ROLES and not user.clinic_id


def parse_bool(value, default=True):
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in ["true", "1", "yes", "active", "aktif"]:
            return True

        if normalized in ["false", "0", "no", "inactive", "tidak aktif"]:
            return False

    return bool(value)


def normalize_profile_photo(value):
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValueError("Foto profil harus berupa teks.")

    photo = value.strip()

    if photo == "":
        return None

    if len(photo) > PROFILE_PHOTO_MAX_LENGTH:
        raise ValueError(
            "Ukuran foto profil terlalu besar. Maksimal sekitar file gambar 2MB."
        )

    if photo.startswith("data:image/"):
        return photo

    if photo.startswith("http://") or photo.startswith("https://"):
        return photo

    raise ValueError("Foto profil harus berupa data URL gambar atau URL gambar.")


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

    requires_clinic_setup = requires_clinic_setup_for_user(user)

    return {
        "user": serialize_user(user, user.user_id if user else None),
        "clinic": serialize_clinic(clinic),
        "requires_clinic_setup": requires_clinic_setup,
        "redirect_path": "/register-clinic"
        if requires_clinic_setup
        else "/dashboard",
    }


def require_login():
    user = get_current_user()

    if not user:
        return None, (jsonify({"msg": "User tidak ditemukan."}), 404)

    if not user.is_active:
        return None, (jsonify({"msg": "Akun Anda sedang tidak aktif."}), 403)

    return user, None


def require_admin():
    user, error_response = require_login()

    if error_response:
        return None, error_response

    if role_to_text(user.user_role) != ADMIN_ROLE:
        return None, (
            jsonify({"msg": "Hanya admin yang dapat mengakses fitur ini."}),
            403,
        )

    return user, None


def require_management_access(require_clinic=True):
    user, error_response = require_login()

    if error_response:
        return None, error_response

    user_role = role_to_text(user.user_role)

    if user_role not in MANAGEMENT_ROLES:
        return None, (
            jsonify(
                {
                    "msg": "Hanya admin atau bidan yang dapat mengakses fitur ini."
                }
            ),
            403,
        )

    if require_clinic and user_role == MIDWIFE_ROLE and not user.clinic_id:
        return None, (
            jsonify(
                {
                    "msg": "Akun bidan belum terhubung dengan klinik.",
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                }
            ),
            400,
        )

    return user, None


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


def get_management_payload(manager):
    manager_role = role_to_text(manager.user_role)

    if manager_role == ADMIN_ROLE:
        employees = User.query.filter(
            User.user_role == MIDWIFE_ROLE
        ).order_by(User.created_at.desc()).all()

        active_count = sum(1 for employee in employees if employee.is_active)
        inactive_count = len(employees) - active_count

        return {
            "user": serialize_user(manager, manager.user_id),
            "clinic": None,
            "employees": [
                serialize_user(employee, manager.user_id) for employee in employees
            ],
            "stats": {
                "total_employees": len(employees),
                "active_employees": active_count,
                "inactive_employees": inactive_count,
                "admins": 0,
                "midwives": len(employees),
                "asistens": 0,
            },
            "roles": [MIDWIFE_ROLE],
            "can_create_midwife": True,
            "can_create_assistant": False,
        }

    if not manager.clinic_id:
        return None

    clinic = db.session.get(Clinic, manager.clinic_id)

    if not clinic:
        return None

    employees = User.query.filter(
        User.clinic_id == manager.clinic_id
    ).order_by(User.created_at.desc()).all()

    active_count = sum(1 for employee in employees if employee.is_active)
    inactive_count = len(employees) - active_count

    return {
        "user": serialize_user(manager, manager.user_id),
        "clinic": serialize_clinic(clinic),
        "employees": [
            serialize_user(employee, manager.user_id) for employee in employees
        ],
        "stats": {
            "total_employees": len(employees),
            "active_employees": active_count,
            "inactive_employees": inactive_count,
            "admins": sum(
                1 for employee in employees if employee.user_role == ADMIN_ROLE
            ),
            "midwives": sum(
                1 for employee in employees if employee.user_role == MIDWIFE_ROLE
            ),
            "asistens": sum(
                1 for employee in employees if employee.user_role == ASSISTANT_ROLE
            ),
        },
        "roles": [ASSISTANT_ROLE],
        "can_create_midwife": False,
        "can_create_assistant": True,
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
                    "msg": "Registrasi publik sudah ditutup. Admin dapat membuat akun bidan melalui Management Setting."
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
        return (
            jsonify(
                {
                    "msg": "Nama lengkap, email, password, dan nomor STR wajib diisi."
                }
            ),
            400,
        )

    if len(password) < 8:
        return jsonify({"msg": "Password minimal 8 karakter."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email sudah digunakan."}), 409

    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg": "Nomor STR sudah digunakan."}), 409

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
                    "msg": "Akun admin pertama berhasil dibuat.",
                    "access_token": create_token_for_user(new_user),
                    "requires_clinic_setup": False,
                    "redirect_path": "/dashboard",
                    "user": serialize_user(new_user, new_user.user_id),
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal membuat akun admin pertama: {str(e)}"}), 500


@auth_bp.route("/management/initial-midwife", methods=["POST"])
@jwt_required()
def create_initial_midwife_by_admin():
    admin, error_response = require_admin()

    if error_response:
        return error_response

    data = request.get_json() or {}

    fullname = (data.get("fullname") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    strnumber = (data.get("strnumber") or "").strip()
    is_active = parse_bool(data.get("is_active", True), default=True)

    if not fullname or not email or not password or not strnumber:
        return (
            jsonify(
                {
                    "msg": "Nama lengkap, email, password, dan nomor STR wajib diisi."
                }
            ),
            400,
        )

    if len(password) < 8:
        return jsonify({"msg": "Password minimal 8 karakter."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email sudah digunakan."}), 409

    if User.query.filter_by(strnumber=strnumber).first():
        return jsonify({"msg": "Nomor STR sudah digunakan."}), 409

    try:
        new_midwife = User(
            fullname=fullname,
            email=email,
            strnumber=strnumber,
            user_role=MIDWIFE_ROLE,
            is_active=is_active,
            clinic_id=None,
        )
        new_midwife.set_password(password)

        db.session.add(new_midwife)
        db.session.flush()

        write_audit_log(
            user_id=admin.user_id,
            action="CREATE_INITIAL_MIDWIFE",
            old_values={},
            new_values={
                **user_old_values(new_midwife, module="Initial Midwife Account"),
                "created_by_admin": True,
                "requires_clinic_setup": True,
            },
        )

        db.session.commit()
        db.session.refresh(new_midwife)

        return (
            jsonify(
                {
                    "msg": "Akun bidan berhasil dibuat. Bidan perlu login dan melengkapi data klinik.",
                    "employee": serialize_user(new_midwife, admin.user_id),
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal membuat akun bidan: {str(e)}"}), 500


@auth_bp.route("/register-clinic", methods=["POST"])
@jwt_required()
def create_or_update_clinic():
    user, error_response = require_login()

    if error_response:
        return error_response

    if role_to_text(user.user_role) != MIDWIFE_ROLE:
        return (
            jsonify(
                {
                    "msg": "Hanya bidan yang dapat membuat atau memperbarui profil klinik."
                }
            ),
            403,
        )

    data = request.get_json() or {}

    clinic_name = (data.get("clinic_name") or "").strip()
    clinic_address = (data.get("clinic_address") or "").strip()
    license_number = (data.get("license_number") or "").strip()
    clinic_email = (data.get("clinic_email") or "").strip().lower()
    clinic_phone = (data.get("clinic_phone") or "").strip()

    if not all([clinic_name, clinic_address, license_number, clinic_email, clinic_phone]):
        return jsonify({"msg": "Semua data klinik wajib diisi."}), 400

    try:
        existing_clinic_email = Clinic.query.filter(
            Clinic.clinic_email == clinic_email,
            Clinic.clinic_id != user.clinic_id,
        ).first()

        if existing_clinic_email:
            return jsonify({"msg": "Email klinik sudah digunakan."}), 409

        existing_license = Clinic.query.filter(
            Clinic.license_number == license_number,
            Clinic.clinic_id != user.clinic_id,
        ).first()

        if existing_license:
            return jsonify({"msg": "Nomor SIPB sudah digunakan."}), 409

        if user.clinic_id:
            clinic = db.session.get(Clinic, user.clinic_id)

            if not clinic:
                return jsonify({"msg": "Data klinik tidak ditemukan."}), 404

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

            user.clinic_id = clinic.clinic_id
            user.is_active = True

        write_audit_log(
            user_id=user.user_id,
            action=action_name,
            old_values=old_values,
            new_values=clinic_old_values(clinic),
        )

        db.session.commit()
        db.session.refresh(user)

        return (
            jsonify(
                {
                    "msg": "Informasi klinik berhasil disimpan.",
                    "access_token": create_token_for_user(user),
                    "requires_clinic_setup": False,
                    "redirect_path": "/dashboard",
                    **serialize_account(user),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal menyimpan data klinik: {str(e)}"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"msg": "Email dan password wajib diisi."}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"msg": "Email atau password salah."}), 401

    if not user.is_active:
        return jsonify({"msg": "Akun Anda sedang tidak aktif."}), 403

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

    requires_clinic_setup = requires_clinic_setup_for_user(user)

    return (
        jsonify(
            {
                "msg": "Login berhasil.",
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
                return jsonify({"msg": "Nama lengkap wajib diisi."}), 400

            user.fullname = fullname

        if email is not None:
            email = email.strip().lower()

            if not email:
                return jsonify({"msg": "Email wajib diisi."}), 400

            existing_email = User.query.filter(
                User.email == email,
                User.user_id != user.user_id,
            ).first()

            if existing_email:
                return jsonify({"msg": "Email sudah digunakan."}), 409

            user.email = email

        if strnumber is not None:
            strnumber = strnumber.strip()

            if not strnumber:
                return jsonify({"msg": "Nomor STR wajib diisi."}), 400

            existing_str = User.query.filter(
                User.strnumber == strnumber,
                User.user_id != user.user_id,
            ).first()

            if existing_str:
                return jsonify({"msg": "Nomor STR sudah digunakan."}), 409

            user.strnumber = strnumber

        if profile_photo_was_provided:
            if not user_has_profile_photo_column(user):
                return (
                    jsonify(
                        {
                            "msg": "Kolom profile_photo belum tersedia pada model User."
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
                    "msg": "Akun berhasil diperbarui.",
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
        return jsonify({"msg": f"Gagal memperbarui akun: {str(e)}"}), 500


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
        return jsonify({"msg": "Semua field password wajib diisi."}), 400

    if new_password != confirm_new_password:
        return jsonify({"msg": "Konfirmasi password baru tidak sesuai."}), 400

    if len(new_password) < 8:
        return jsonify({"msg": "Password baru minimal 8 karakter."}), 400

    if current_password == new_password:
        return (
            jsonify({"msg": "Password baru tidak boleh sama dengan password lama."}),
            400,
        )

    if not user.check_password(current_password):
        return jsonify({"msg": "Password lama salah."}), 401

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

        return jsonify({"msg": "Password berhasil diubah."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal mengubah password: {str(e)}"}), 500


@auth_bp.route("/management/overview", methods=["GET"])
@jwt_required()
def get_management_overview():
    manager, error_response = require_management_access(require_clinic=False)

    if error_response:
        return error_response

    manager_role = role_to_text(manager.user_role)

    if manager_role == MIDWIFE_ROLE and not manager.clinic_id:
        return (
            jsonify(
                {
                    "msg": "Akun bidan belum terhubung dengan klinik.",
                    "requires_clinic_setup": True,
                    "redirect_path": "/register-clinic",
                }
            ),
            400,
        )

    payload = get_management_payload(manager)

    if not payload:
        return jsonify({"msg": "Data management tidak ditemukan."}), 404

    return jsonify(payload), 200


@auth_bp.route("/management/clinic", methods=["PATCH"])
@jwt_required()
def update_management_clinic():
    manager, error_response = require_management_access(require_clinic=True)

    if error_response:
        return error_response

    if role_to_text(manager.user_role) != MIDWIFE_ROLE:
        return jsonify({"msg": "Hanya bidan yang dapat memperbarui data klinik."}), 403

    clinic = db.session.get(Clinic, manager.clinic_id)

    if not clinic:
        return jsonify({"msg": "Data klinik tidak ditemukan."}), 404

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
                return jsonify({"msg": "Nama klinik wajib diisi."}), 400

            clinic.clinic_name = clinic_name

        if clinic_address is not None:
            clinic_address = clinic_address.strip()

            if not clinic_address:
                return jsonify({"msg": "Alamat klinik wajib diisi."}), 400

            clinic.clinic_address = clinic_address

        if license_number is not None:
            license_number = license_number.strip()

            if not license_number:
                return jsonify({"msg": "Nomor SIPB wajib diisi."}), 400

            existing_license = Clinic.query.filter(
                Clinic.license_number == license_number,
                Clinic.clinic_id != clinic.clinic_id,
            ).first()

            if existing_license:
                return jsonify({"msg": "Nomor SIPB sudah digunakan."}), 409

            clinic.license_number = license_number

        if clinic_email is not None:
            clinic_email = clinic_email.strip().lower()

            if not clinic_email:
                return jsonify({"msg": "Email klinik wajib diisi."}), 400

            existing_clinic_email = Clinic.query.filter(
                Clinic.clinic_email == clinic_email,
                Clinic.clinic_id != clinic.clinic_id,
            ).first()

            if existing_clinic_email:
                return jsonify({"msg": "Email klinik sudah digunakan."}), 409

            clinic.clinic_email = clinic_email

        if clinic_phone is not None:
            clinic_phone = clinic_phone.strip()

            if not clinic_phone:
                return jsonify({"msg": "Nomor telepon klinik wajib diisi."}), 400

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
            return jsonify({"msg": "Semua data klinik wajib diisi."}), 400

        write_audit_log(
            user_id=manager.user_id,
            action="UPDATE_CLINIC",
            old_values=old_values,
            new_values=clinic_old_values(clinic),
        )

        db.session.commit()
        db.session.refresh(clinic)

        return (
            jsonify(
                {
                    "msg": "Informasi klinik berhasil diperbarui.",
                    "clinic": serialize_clinic(clinic),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal memperbarui data klinik: {str(e)}"}), 500


@auth_bp.route("/management/users", methods=["POST"])
@jwt_required()
def create_management_user():
    manager, error_response = require_management_access(require_clinic=False)

    if error_response:
        return error_response

    data = request.get_json() or {}

    fullname = (data.get("fullname") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    strnumber = (data.get("strnumber") or "").strip()
    is_active = parse_bool(data.get("is_active", True), default=True)

    try:
        role = normalize_role(data.get("role", ASSISTANT_ROLE))
    except ValueError as e:
        return jsonify({"msg": str(e)}), 400

    manager_role = role_to_text(manager.user_role)

    if manager_role == ADMIN_ROLE and role != MIDWIFE_ROLE:
        return jsonify({"msg": "Admin hanya dapat membuat akun bidan."}), 403

    if manager_role == MIDWIFE_ROLE:
        if not manager.clinic_id:
            return (
                jsonify(
                    {
                        "msg": "Akun bidan belum terhubung dengan klinik.",
                        "requires_clinic_setup": True,
                        "redirect_path": "/register-clinic",
                    }
                ),
                400,
            )

        if role != ASSISTANT_ROLE:
            return jsonify({"msg": "Bidan hanya dapat membuat akun asisten."}), 403

    if not fullname or not email or not password or not strnumber:
        return (
            jsonify(
                {
                    "msg": "Nama lengkap, email, password, dan nomor STR wajib diisi."
                }
            ),
            400,
        )

    if len(password) < 8:
        return jsonify({"msg": "Password minimal 8 karakter."}), 400

    existing_user_by_email = User.query.filter_by(email=email).first()
    existing_user_by_strnumber = User.query.filter_by(strnumber=strnumber).first()

    if existing_user_by_strnumber and (
        not existing_user_by_email
        or str(existing_user_by_strnumber.user_id)
        != str(existing_user_by_email.user_id)
    ):
        return jsonify({"msg": "Nomor STR sudah digunakan oleh akun lain."}), 409

    try:
        if existing_user_by_email:
            old_values = user_old_values(existing_user_by_email, module="User Access")

            if existing_user_by_email.is_active:
                return jsonify({"msg": "Email sudah aktif digunakan."}), 409

            if (
                existing_user_by_email.clinic_id
                and manager_role == MIDWIFE_ROLE
                and existing_user_by_email.clinic_id != manager.clinic_id
            ):
                return jsonify({"msg": "Email sudah digunakan oleh klinik lain."}), 409

            existing_user_by_email.fullname = fullname
            existing_user_by_email.strnumber = strnumber
            existing_user_by_email.user_role = role
            existing_user_by_email.clinic_id = (
                None if manager_role == ADMIN_ROLE else manager.clinic_id
            )
            existing_user_by_email.is_active = is_active
            existing_user_by_email.set_password(password)

            db.session.flush()

            write_audit_log(
                user_id=manager.user_id,
                action="REACTIVATE_ACCOUNT",
                old_values=old_values,
                new_values={
                    **user_old_values(existing_user_by_email, module="User Access"),
                    "reactivated": True,
                    "requires_clinic_setup": role == MIDWIFE_ROLE
                    and not existing_user_by_email.clinic_id,
                },
            )

            db.session.commit()
            db.session.refresh(existing_user_by_email)

            return (
                jsonify(
                    {
                        "msg": "Akun user berhasil diaktifkan kembali.",
                        "employee": serialize_user(
                            existing_user_by_email,
                            manager.user_id,
                        ),
                        "requires_clinic_setup": role == MIDWIFE_ROLE
                        and not existing_user_by_email.clinic_id,
                    }
                ),
                200,
            )

        new_user = User(
            clinic_id=None if manager_role == ADMIN_ROLE else manager.clinic_id,
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
            user_id=manager.user_id,
            action="CREATE_INITIAL_MIDWIFE" if role == MIDWIFE_ROLE else "ADD_ACCOUNT",
            old_values={},
            new_values={
                **user_old_values(
                    new_user,
                    module="Initial Midwife Account"
                    if role == MIDWIFE_ROLE
                    else "User Access",
                ),
                "requires_clinic_setup": role == MIDWIFE_ROLE
                and not new_user.clinic_id,
            },
        )

        db.session.commit()
        db.session.refresh(new_user)

        return (
            jsonify(
                {
                    "msg": "Akun user berhasil dibuat.",
                    "employee": serialize_user(new_user, manager.user_id),
                    "requires_clinic_setup": role == MIDWIFE_ROLE
                    and not new_user.clinic_id,
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal membuat akun user: {str(e)}"}), 500


@auth_bp.route("/management/employees", methods=["GET"])
@jwt_required()
def get_management_employees():
    manager, error_response = require_management_access(require_clinic=False)

    if error_response:
        return error_response

    manager_role = role_to_text(manager.user_role)

    if manager_role == ADMIN_ROLE:
        employees = User.query.filter(
            User.user_role == MIDWIFE_ROLE
        ).order_by(User.created_at.desc()).all()
    else:
        if not manager.clinic_id:
            return (
                jsonify(
                    {
                        "msg": "Akun bidan belum terhubung dengan klinik.",
                        "requires_clinic_setup": True,
                        "redirect_path": "/register-clinic",
                    }
                ),
                400,
            )

        employees = User.query.filter(
            User.clinic_id == manager.clinic_id
        ).order_by(User.created_at.desc()).all()

    return (
        jsonify(
            {
                "employees": [
                    serialize_user(employee, manager.user_id) for employee in employees
                ]
            }
        ),
        200,
    )


@auth_bp.route("/management/employees/<employee_id>", methods=["PATCH"])
@jwt_required()
def update_management_employee(employee_id):
    manager, error_response = require_management_access(require_clinic=False)

    if error_response:
        return error_response

    manager_role = role_to_text(manager.user_role)

    if manager_role == ADMIN_ROLE:
        employee = User.query.filter(
            User.user_id == str(employee_id),
            User.user_role == MIDWIFE_ROLE,
        ).first()
    else:
        if not manager.clinic_id:
            return (
                jsonify(
                    {
                        "msg": "Akun bidan belum terhubung dengan klinik.",
                        "requires_clinic_setup": True,
                        "redirect_path": "/register-clinic",
                    }
                ),
                400,
            )

        employee = User.query.filter(
            User.user_id == str(employee_id),
            User.clinic_id == manager.clinic_id,
            User.user_role == ASSISTANT_ROLE,
        ).first()

    if not employee:
        return jsonify({"msg": "User tidak ditemukan atau tidak dapat dikelola."}), 404

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

    if manager_role == ADMIN_ROLE and new_role != MIDWIFE_ROLE:
        return jsonify({"msg": "Admin hanya dapat mengelola akun bidan."}), 403

    if manager_role == MIDWIFE_ROLE and new_role != ASSISTANT_ROLE:
        return jsonify({"msg": "Bidan hanya dapat mengelola akun asisten."}), 403

    if active_was_changed:
        new_is_active = parse_bool(data.get("is_active"), default=employee.is_active)

    if str(employee.user_id) == str(manager.user_id):
        if role_was_changed and new_role != employee.user_role:
            return jsonify({"msg": "Anda tidak dapat mengubah role akun sendiri."}), 400

        if active_was_changed and new_is_active != employee.is_active:
            return jsonify({"msg": "Anda tidak dapat menonaktifkan akun sendiri."}), 400

    try:
        old_values = user_old_values(employee, module="User Access")

        employee.user_role = new_role
        employee.is_active = new_is_active

        write_audit_log(
            user_id=manager.user_id,
            action="UPDATE_USER_ACCESS",
            old_values=old_values,
            new_values=user_old_values(employee, module="User Access"),
        )

        db.session.commit()
        db.session.refresh(employee)

        return (
            jsonify(
                {
                    "msg": "Data user berhasil diperbarui.",
                    "employee": serialize_user(employee, manager.user_id),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal memperbarui user: {str(e)}"}), 500


@auth_bp.route("/management/employees/<employee_id>", methods=["DELETE"])
@jwt_required()
def unlink_management_employee(employee_id):
    manager, error_response = require_management_access(require_clinic=False)

    if error_response:
        return error_response

    manager_role = role_to_text(manager.user_role)

    if manager_role == ADMIN_ROLE:
        employee = User.query.filter(
            User.user_id == str(employee_id),
            User.user_role == MIDWIFE_ROLE,
        ).first()
    else:
        if not manager.clinic_id:
            return (
                jsonify(
                    {
                        "msg": "Akun bidan belum terhubung dengan klinik.",
                        "requires_clinic_setup": True,
                        "redirect_path": "/register-clinic",
                    }
                ),
                400,
            )

        employee = User.query.filter(
            User.user_id == str(employee_id),
            User.clinic_id == manager.clinic_id,
            User.user_role == ASSISTANT_ROLE,
        ).first()

    if not employee:
        return jsonify({"msg": "User tidak ditemukan atau tidak dapat dikelola."}), 404

    if str(employee.user_id) == str(manager.user_id):
        return jsonify({"msg": "Anda tidak dapat menghapus akun sendiri."}), 400

    try:
        old_values = user_old_values(employee, module="User Access")

        employee.clinic_id = None
        employee.is_active = False

        db.session.flush()

        write_audit_log(
            user_id=manager.user_id,
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
                    "msg": "User berhasil dihapus dari akses klinik.",
                    "removed_employee_id": str(employee_id),
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Gagal menghapus user: {str(e)}"}), 500