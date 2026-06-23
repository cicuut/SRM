from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.diagnose import get_top_diagnoses_payload
from app.forecast_service import build_forecast_payload
from app.models import User, db


dashboard_bp = Blueprint("dashboard", __name__)


DASHBOARD_ALLOWED_ROLES = ["admin", "midwife", "asisten"]


def role_to_text(value):
    if value is None:
        return ""

    if hasattr(value, "value"):
        return str(value.value)

    return str(value)


def normalize_role(role):
    normalized = str(role or "").strip().lower()

    role_aliases = {
        "admin": "admin",
        "developer": "admin",
        "midwife": "midwife",
        "bidan": "midwife",
        "owner": "midwife",
        "asisten": "asisten",
        "assistant": "asisten",
        "staff": "asisten",
    }

    return role_aliases.get(normalized, normalized)


def get_current_user():
    user_id = get_jwt_identity()

    if not user_id:
        return None

    return db.session.get(User, user_id)


def require_dashboard_access():
    current_user = get_current_user()

    if not current_user:
        return None, "", (
            jsonify({"msg": "User tidak ditemukan."}),
            404,
        )

    if not current_user.is_active:
        return None, "", (
            jsonify({"msg": "Akun Anda sedang tidak aktif."}),
            403,
        )

    current_role = normalize_role(role_to_text(current_user.user_role))

    if current_role not in DASHBOARD_ALLOWED_ROLES:
        return None, current_role, (
            jsonify({"msg": "Akses ditolak."}),
            403,
        )

    if current_role in ["midwife", "asisten"] and not current_user.clinic_id:
        return None, current_role, (
            jsonify(
                {
                    "msg": "Akun belum terhubung dengan klinik.",
                    "requires_clinic_setup": current_role == "midwife",
                    "redirect_path": "/register-clinic"
                    if current_role == "midwife"
                    else "/dashboard",
                }
            ),
            400,
        )

    return current_user, current_role, None


def get_limit_from_request():
    try:
        limit = int(request.args.get("limit", 5))
        return max(1, min(limit, 20))
    except (TypeError, ValueError):
        return 5


@dashboard_bp.route("/top-diagnoses", methods=["GET"])
@jwt_required()
def get_top_diagnoses():
    current_user, current_role, error_response = require_dashboard_access()

    if error_response:
        return error_response

    limit = get_limit_from_request()

    try:
        payload = get_top_diagnoses_payload(top_n=limit)

        return jsonify(payload), 200

    except Exception as exc:
        return (
            jsonify(
                {
                    "msg": "Gagal menghitung top diagnosa.",
                    "error": str(exc),
                    "top_diagnoses": [],
                    "total_visits_with_diagnoses": 0,
                    "total_diagnoses_fragments": 0,
                }
            ),
            500,
        )


@dashboard_bp.route("/visitors", methods=["GET"])
@jwt_required()
def get_visitor_forecast():
    current_user, current_role, error_response = require_dashboard_access()

    if error_response:
        return error_response

    try:
        payload = build_forecast_payload()

        return jsonify(payload), 200

    except FileNotFoundError as exc:
        return (
            jsonify(
                {
                    "msg": "Model forecasting tidak ditemukan.",
                    "error": str(exc),
                }
            ),
            500,
        )

    except Exception as exc:
        return (
            jsonify(
                {
                    "msg": "Gagal menghitung perkiraan pengunjung.",
                    "error": str(exc),
                }
            ),
            500,
        )