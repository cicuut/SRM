from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.forecast_service import SERVICE_MODELS, build_forecast_payload

forecast_bp = Blueprint("forecast", __name__)


@forecast_bp.route("/visitors", methods=["GET"])
@jwt_required()
def get_visitor_forecast():
    try:
        payload = build_forecast_payload()
        return jsonify(payload), 200
    except FileNotFoundError as exc:
        return jsonify({"msg": "Model forecasting tidak ditemukan", "error": str(exc)}), 500
    except Exception as exc:
        return jsonify({"msg": "Gagal menghitung perkiraan pengunjung", "error": str(exc)}), 500


@forecast_bp.route("/services", methods=["GET"])
@jwt_required()
def get_forecast_services():
    return jsonify({"services": list(SERVICE_MODELS.keys())}), 200
