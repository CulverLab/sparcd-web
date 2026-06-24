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


def _reconcile_sandbox(db: SPARCdDatabase) -> None:
    """ Reconciles sandbox state at startup, completing interrupted uploads
        and notifying users of any issues found
    Arguments:
        db: the connected database instance
    """
    rows = db.sandbox_get_incomplete()
    if not rows:
        return

    for name, s3_id, upload_id, completion_status, s3_base_path in rows:
        if completion_status == 3:
            # Should never happen — sandbox_upload_complete resets path to ""
            print(f'WARNING: sandbox reconciliation found completion_status=3 with '
                  f'path != "" for user {name} upload {upload_id}', flush=True)

        elif completion_status in (1, 2):
            # CSVs written but sandbox_upload_complete never called
            # Safe to complete without S3 access since files are confirmed on S3
            print(f'INFO: sandbox reconciliation completing interrupted upload '
                  f'for user {name} upload {upload_id}', flush=True)

            db.sandbox_upload_complete(name, upload_id)

            db.message_add(s3_id, 'system', name,
                           'Upload completed after server interruption',
                           f'Your upload ({s3_base_path}) completed successfully '
                           f'after a server interruption.',
                           'normal')

        elif completion_status == 0:
            # Crashed during file uploads — leave untouched, notify user
            print(f'INFO: sandbox reconciliation found interrupted upload '
                  f'for user {name} upload {upload_id}', flush=True)

            db.message_add(s3_id, 'system', name,
                           'Upload interrupted and needs attention',
                           f'Your upload ({s3_base_path}) was interrupted and '
                           f'needs attention. Please log in to resume or abandon it.',
                           'normal')


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
_reconcile_sandbox(_db)     # Clean up the DB as needed
del _db
_db = None
print(f'Using database at {DEFAULT_DB_PATH}, {DEFAULT_DB_SANDBOX_PATH}', flush=True)
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
