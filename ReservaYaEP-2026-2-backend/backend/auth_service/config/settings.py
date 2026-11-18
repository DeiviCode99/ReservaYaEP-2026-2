"""auth_service — registro, login, Google, recuperación de cuenta y JWT
(RF-01, RF-02, RF-14, RF-15, RF-16). Dueño de la tabla `users`."""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
_COMMON = str(BASE_DIR.parent / "common")
if _COMMON not in sys.path:
    sys.path.insert(0, _COMMON)

from reservaya_common.settings_base import base_settings, env, env_int, load_dotenv  # noqa: E402

load_dotenv(BASE_DIR.parent / ".env")
globals().update(base_settings("auth-service", with_db=True, extra_apps=["accounts"]))

# Inicio de sesión con Google: vacío = el frontend oculta el botón.
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID")

# Recuperación de cuenta: el enlace del correo apunta al frontend.
FRONTEND_ORIGIN = env("FRONTEND_ORIGIN", "http://localhost:3000")
RESET_EXPIRATION_MINUTES = env_int("RESET_EXPIRATION_MINUTES", 30)

# Correo. Sin EMAIL_HOST el enlace se escribe en el log (modo desarrollo).
# Se aceptan también los nombres SPRING_MAIL_* del backend anterior.
EMAIL_HOST = env("EMAIL_HOST", env("SPRING_MAIL_HOST"))
EMAIL_PORT = env_int("EMAIL_PORT", int(env("SPRING_MAIL_PORT", "587")))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", env("SPRING_MAIL_USERNAME"))
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", env("SPRING_MAIL_PASSWORD"))
EMAIL_USE_TLS = True
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = env("MAIL_FROM", "no-reply@reservaya.local")
