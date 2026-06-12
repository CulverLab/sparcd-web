#!/usr/bin/python3
""" This script contains the API for the SPARC'd server """

import tempfile

from flask import Flask

from sparcd_env import DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH
from sparcd_db import SPARCdDatabase

from routes.admin_routes import admin_bp
from routes.auth_routes import auth_bp
from routes.image_routes import image_bp
from routes.install_routes import install_bp
from routes.message_routes import message_bp
from routes.misc_routes import misc_bp
from routes.query_routes import query_bp
from routes.sandbox_routes import sandbox_bp
from routes.species_routes import species_bp
from routes.static_routes import static_bp
from routes.upload_routes import upload_bp


# Initialize server
app = Flask(__name__)

# Secure cookie settings
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=600,
)
app.config.from_object(__name__)

# Initialize and verify the database connection
_db = SPARCdDatabase(DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH)
_db.connect()
del _db
_db = None
print(f'Using database at {DEFAULT_DB_PATH, DEFAULT_DB_SANDBOX_PATH}', flush=True)
print(f'Temporary folder at {tempfile.gettempdir()}', flush=True)

# Register blueprints
app.register_blueprint(admin_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(image_bp)
app.register_blueprint(install_bp)
app.register_blueprint(message_bp)
app.register_blueprint(misc_bp)
app.register_blueprint(query_bp)
app.register_blueprint(sandbox_bp)
app.register_blueprint(species_bp)
app.register_blueprint(static_bp)
app.register_blueprint(upload_bp)
