""" Configuration and shared utilities for SPARCd server """

import os


# =============================================================================
# Environment variable names
# =============================================================================

# Environment variable name for allowed origins
ENV_ALLOWED_ORIGINS = 'SPARCD_ALLOWED_ORIGINS'
# Environment variable name for allowed origins for API
ENV_API_ALLOWED_ORIGINS = 'SPARCD_API_ALLOWED_ORIGINS'
# Environment variable name for database
ENV_NAME_DB = 'SPARCD_DB'
# Environment variable name for sandbox database
ENV_NAME_DB_SANDBOX = 'SPARCD_SANDBOX_DB'
# Environment variable name for passcode
ENV_NAME_PASSCODE = 'SPARCD_CODE'
# Environment variable name for session expiration timeout
ENV_NAME_SESSION_EXPIRE = 'SPARCD_SESSION_TIMEOUT'
# Environment variable name for default settings files
ENV_DEFAULT_SETTINGS_PATH = 'SPARCD_DEFAULT_SETTINGS_PATH'
# Environment variable name for default timezone offset
ENV_DEFAULT_TIMEZONE_OFFSET = 'SPARCD_DEFAULT_TIMEZONE_OFFSET'


# =============================================================================
# Environment variable values
# =============================================================================

# The allowed origins
DEFAULT_ALLOWED_ORIGINS = 'http://localhost:3000'
ALLOWED_ORIGINS = os.environ.get(ENV_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS)

DEFAULT_API_ALLOWED_ORIGINS = "*"
API_ALLOWED_ORIGINS = os.environ.get(ENV_API_ALLOWED_ORIGINS, DEFAULT_API_ALLOWED_ORIGINS)

# Working database storage path
DEFAULT_DB_PATH = os.environ.get(ENV_NAME_DB, None)
DEFAULT_DB_SANDBOX_PATH = os.environ.get(ENV_NAME_DB_SANDBOX, None)

# Working passcode
CONFIGURED_PASSCODE = os.environ.get(ENV_NAME_PASSCODE, None)

# Working amount of time after last action before session is expired
SESSION_EXPIRE_DEFAULT_SEC = 10 * 60 * 60
SESSION_EXPIRE_SECONDS = os.environ.get(ENV_NAME_SESSION_EXPIRE, SESSION_EXPIRE_DEFAULT_SEC)

# Folder that has the template settings files used to setup a new SPARCd instance or repair one
DEFAULT_SETTINGS_PATH = os.environ.get(ENV_DEFAULT_SETTINGS_PATH,
                                       os.path.join(os.getcwd(), 'defaultSettings'))


# Default timezone offset in seconds
DEFAULT_TIMEZONE_OFFSET_HOUR = -7.00
DEFAULT_TIMEZONE_OFFSET = int(float(os.environ.get(ENV_DEFAULT_TIMEZONE_OFFSET,
                                                            DEFAULT_TIMEZONE_OFFSET_HOUR))*60*60)


# =============================================================================
# Startup validation
# =============================================================================

# Build the sandbox DB if it's not specified
if not DEFAULT_DB_SANDBOX_PATH:
    base, ext = os.path.splitext(DEFAULT_DB_PATH)
    DEFAULT_DB_SANDBOX_PATH = base + '_sandbox' + ext
