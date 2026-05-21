from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.assessment_service import get_top_assessments_payload
from app.models import User, db

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/top-assessments", methods=["GET"])
@jwt_required()
def get_top_assessments():
    user_id = get_jwt_identity()
    current_user = db.session.get(User, user_id)

    if not current_user:
        return jsonify({"msg": "User tidak ditemukan"}), 404

    if not current_user.clinic_id:
        return jsonify({"msg": "Akun belum terhubung ke klinik"}), 400

    try:
        limit = int(request.args.get("limit", 5))
        limit = max(1, min(limit, 20))
    except (TypeError, ValueError):
        limit = 5

    try:
        payload = get_top_assessments_payload(current_user.clinic_id, top_n=limit)
        return jsonify(payload), 200
    except Exception as exc:
        return (
            jsonify(
                {
                    "msg": "Gagal menghitung top assessment",
                    "error": str(exc),
                    "top_assessments": [],
                }
            ),
            500,
        )
