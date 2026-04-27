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

    CORS(app)

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)

    db.init_app(app)
    jwt = JWTManager(app)

    from .routes.auth import auth_bp
    from .routes.medical_record import medical_record_bp
    from .routes.visit_report import visit_report_bp
    from .routes.financial import financial_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(medical_record_bp, url_prefix='/api/medical-record')
    app.register_blueprint(visit_report_bp, url_prefix='/api/visit-report')
    app.register_blueprint(financial_bp, url_prefix='/api/financial')

    return app