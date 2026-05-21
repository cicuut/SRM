from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from datetime import timedelta
import os
from dotenv import load_dotenv


db = SQLAlchemy()


def create_app():
    load_dotenv()

    app = Flask(__name__)

    CORS(
        app,
        supports_credentials=True,
        resources={
            r"/api/*": {
                "origins": "*",
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
            }
        },
    )

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)

    db.init_app(app)
    JWTManager(app)

    # Register auto audit hook.
    # Ini yang bikin aktivitas create/update/delete dari ORM otomatis masuk audit log.
    from .audit_hooks import register_audit_hooks
    register_audit_hooks()

    from .routes.auth import auth_bp
    from .routes.medical_record import medical_record_bp
    from .routes.visit_report import visit_report_bp
    from .routes.financial import financial_bp
    from .routes.activity_history import activity_history_bp
    from .routes.forecast import forecast_bp
    from .routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(medical_record_bp, url_prefix="/api/medical-record")
    app.register_blueprint(visit_report_bp, url_prefix="/api/visit-report")
    app.register_blueprint(financial_bp, url_prefix="/api/financial")
    app.register_blueprint(activity_history_bp, url_prefix="/api/activity-history")
    app.register_blueprint(forecast_bp, url_prefix="/api/forecast")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    return app