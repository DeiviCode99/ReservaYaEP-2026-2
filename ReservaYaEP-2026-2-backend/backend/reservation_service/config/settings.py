"""reservation_service — reservas, disponibilidad y cambios de estado (RF-05 a RF-12).
Dueño de las tablas reservations y reservation_audit."""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
_COMMON = str(BASE_DIR.parent / "common")
if _COMMON not in sys.path:
    sys.path.insert(0, _COMMON)

from reservaya_common.settings_base import base_settings, env, env_int, load_dotenv  # noqa: E402

load_dotenv(BASE_DIR.parent / ".env")
globals().update(base_settings("reservation-service", with_db=True, extra_apps=["bookings"]))

# De restaurant_service salen aforo, horarios y dueño de cada sede; de auth_service,
# el nombre y correo de los clientes para el panel del restaurante.
RESTAURANT_SERVICE_URI = env("RESTAURANT_SERVICE_URI", "http://localhost:8082").rstrip("/")
AUTH_SERVICE_URI = env("AUTH_SERVICE_URI", "http://localhost:8081").rstrip("/")

# Reglas de negocio
MIN_HOURS_BEFORE_CANCEL = env_int("MIN_HOURS_BEFORE_CANCEL", 2)

# Notificaciones. Sin EMAIL_HOST quedan en el log. Acepta también SPRING_MAIL_*.
EMAIL_HOST = env("EMAIL_HOST", env("SPRING_MAIL_HOST"))
EMAIL_PORT = env_int("EMAIL_PORT", int(env("SPRING_MAIL_PORT", "587")))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", env("SPRING_MAIL_USERNAME"))
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", env("SPRING_MAIL_PASSWORD"))
EMAIL_USE_TLS = True
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = env("MAIL_FROM", "no-reply@reservaya.local")
