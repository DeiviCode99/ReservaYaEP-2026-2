"""gateway — punto de entrada único del frontend (RNF-05).

No tiene base de datos: reenvía /api/auth, /api/restaurants y /api/reservations
al servicio que corresponde y aplica CORS. /internal/** nunca se expone.
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
_COMMON = str(BASE_DIR.parent / "common")
if _COMMON not in sys.path:
    sys.path.insert(0, _COMMON)

from reservaya_common.settings_base import base_settings, env, load_dotenv  # noqa: E402

load_dotenv(BASE_DIR.parent / ".env")
globals().update(base_settings("gateway", with_db=False, extra_apps=["corsheaders"]))
MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", *MIDDLEWARE]  # noqa: F821

SERVICE_ROUTES = {
    "auth": env("AUTH_SERVICE_URI", "http://localhost:8081"),
    "restaurants": env("RESTAURANT_SERVICE_URI", "http://localhost:8082"),
    "reservations": env("RESERVATION_SERVICE_URI", "http://localhost:8083"),
}

# CORS: el frontend de desarrollo corre en el puerto 3000. En producción Caddy
# sirve el frontend y la API en el mismo dominio, así que CORS no interviene.
CORS_ALLOWED_ORIGINS = [o.strip() for o in env("FRONTEND_ORIGIN", "http://localhost:3000").split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_PREFLIGHT_MAX_AGE = 3600

# Detrás de Caddy la petición llega por http; con esto Django ve el https original.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
