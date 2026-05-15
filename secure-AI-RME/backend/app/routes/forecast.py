from datetime import date

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.forecast_service import SERVICE_MODELS, build_forecast_payload
from app.models import User, db

forecast_bp = Blueprint("forecast", __name__)


def _get_clinic_id():
    claims = get_jwt() or {}
    clinic_id = claims.get("clinic_id")
    if clinic_id:
        return str(clinic_id)

    user_id = get_jwt_identity()
    if user_id:
        user = db.session.get(User, user_id)
        if user and user.clinic_id:
            return str(user.clinic_id)
    return None


@forecast_bp.route("/visitors", methods=["GET"])
@jwt_required()
def get_visitor_forecast():
    clinic_id = _get_clinic_id()
    if not clinic_id:
        return jsonify({"msg": "Akun belum terhubung ke klinik"}), 400

    try:
        payload = build_forecast_payload(clinic_id)
        return jsonify(payload), 200
    except FileNotFoundError as exc:
        return jsonify({"msg": "Model forecasting tidak ditemukan", "error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"msg": "Gagal menghitung perkiraan pengunjung", "error": str(exc)}), 500


@forecast_bp.route("/services", methods=["GET"])
@jwt_required()
def get_forecast_services():
    return jsonify({"services": list(SERVICE_MODELS.keys())}), 200
