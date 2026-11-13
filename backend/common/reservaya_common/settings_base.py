"""Configuración común de los proyectos Django, leída de variables de entorno.

No importa Django: cada settings.py hace `globals().update(base_settings(...))`.
"""
import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


def env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return default if value is None or value.strip() == "" else value.strip()


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "si", "sí", "on"}


def env_int(name: str, default: int) -> int:
    return int(env(name, str(default)))


def load_dotenv(path: Path) -> None:
    """Carga backend/.env sin pisar variables ya definidas (útil en desarrollo)."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def database_from_env() -> dict:
    """DATABASES['default'] a partir de SUPABASE_DB_URL (acepta el formato JDBC del backend anterior)."""
    url = env("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("Falta SUPABASE_DB_URL (ver backend/.env.example).")
    if url.startswith("jdbc:"):
        url = url[len("jdbc:"):]
    parsed = urlparse(url)
    query = {k: v[-1] for k, v in parse_qs(parsed.query).items()}
    options = {}
    if "sslmode" in query:
        options["sslmode"] = query["sslmode"]
    # Con el pooler en modo transacción (puerto 6543) no hay sentencias preparadas.
    if parsed.port == 6543:
        options["prepare_threshold"] = None
    return {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": parsed.hostname or "localhost",
        "PORT": str(parsed.port or 5432),
        "NAME": (parsed.path or "/postgres").lstrip("/") or "postgres",
        "USER": env("SUPABASE_DB_USER", unquote(parsed.username or "")),
        "PASSWORD": env("SUPABASE_DB_PASSWORD", unquote(parsed.password or "")),
        "OPTIONS": options,
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
        "TEST": {"NAME": env("TEST_DB_NAME", "reservaya_test")},
    }


def base_settings(service_name: str, *, with_db: bool, extra_apps: list[str] | None = None) -> dict:
    """Ajustes compartidos. Cada servicio añade sus apps, URLs y valores propios."""
    debug = env_bool("DJANGO_DEBUG", False)
    settings = {
        "SECRET_KEY": env("DJANGO_SECRET_KEY", env("JWT_SECRET", "solo-para-desarrollo")),
        "DEBUG": debug,
        "ALLOWED_HOSTS": env("ALLOWED_HOSTS", "*").split(","),
        "INSTALLED_APPS": ["rest_framework", *(extra_apps or [])],
        "MIDDLEWARE": ["django.middleware.common.CommonMiddleware"],
        "ROOT_URLCONF": "config.urls",
        "WSGI_APPLICATION": "config.wsgi.application",
        "LANGUAGE_CODE": "es-co",
        "TIME_ZONE": "America/Bogota",
        "USE_I18N": True,
        "USE_TZ": True,
        "APPEND_SLASH": False,
        "DATABASES": {"default": database_from_env()} if with_db else {},
        "DEFAULT_AUTO_FIELD": "django.db.models.BigAutoField",
        "REST_FRAMEWORK": {
            "DEFAULT_AUTHENTICATION_CLASSES": ["reservaya_common.drf.JWTAuthentication"],
            "DEFAULT_PERMISSION_CLASSES": ["reservaya_common.drf.IsAuthenticated"],
            "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
            "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
            "EXCEPTION_HANDLER": "reservaya_common.drf.exception_handler",
            "UNAUTHENTICATED_USER": None,
            "COERCE_DECIMAL_TO_STRING": False,
        },
        "RESERVAYA_JWT": {
            "SECRET": env("JWT_SECRET"),
            "ISSUER": env("JWT_ISSUER", "reservaya-auth"),
            "EXPIRATION_MINUTES": env_int("JWT_EXPIRATION_MINUTES", 120),
        },
        "LOGGING": {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"simple": {"format": f"%(asctime)s {service_name} %(levelname)s %(name)s: %(message)s"}},
            "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
            "root": {"handlers": ["console"], "level": "INFO"},
        },
    }
    # El gateway no verifica tokens; los servicios con BD sí.
    if with_db and len(settings["RESERVAYA_JWT"]["SECRET"]) < 32:
        raise RuntimeError(
            f"JWT_SECRET debe tener al menos 32 caracteres y tiene {len(settings['RESERVAYA_JWT']['SECRET'])}. "
            "Genera uno con: python -c \"import secrets; print(secrets.token_urlsafe(48))\" (ver backend/.env.example).")
    return settings
