"""Apoyo para las pruebas de Django de cada servicio.

Las pruebas usan un PostgreSQL LOCAL (nunca Supabase) y cargan db/schema.sql,
porque los modelos son managed=False y Django no crea las tablas.
"""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
SCHEMA_PATH = BACKEND_DIR / "db" / "schema.sql"
DEFAULT_TEST_URL = "postgresql://postgres:postgres@localhost:5433/postgres"
TEST_JWT_SECRET = "clave-solo-para-pruebas-de-al-menos-32-caracteres"


def configure_test_env() -> None:
    """Se llama desde config/test_settings.py ANTES de importar settings."""
    url = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_URL)
    if "supabase" in url:
        raise RuntimeError("Las pruebas no se ejecutan contra Supabase: usa TEST_DATABASE_URL local.")
    os.environ["SUPABASE_DB_URL"] = url
    # Vacíos para que usuario y contraseña salgan de la URL de prueba y no del .env.
    os.environ["SUPABASE_DB_USER"] = ""
    os.environ["SUPABASE_DB_PASSWORD"] = ""
    os.environ["JWT_SECRET"] = TEST_JWT_SECRET
    os.environ["JWT_ISSUER"] = "reservaya-auth"
    os.environ["EMAIL_HOST"] = ""
    os.environ["SPRING_MAIL_HOST"] = ""
    os.environ["GOOGLE_CLIENT_ID"] = "cliente-de-prueba.apps.googleusercontent.com"
    os.environ["FRONTEND_ORIGIN"] = "http://localhost:3000"
    os.environ["AUTH_SERVICE_URI"] = "http://auth.test"
    os.environ["RESTAURANT_SERVICE_URI"] = "http://restaurant.test"
    os.environ["RESERVATION_SERVICE_URI"] = "http://reservation.test"


def load_schema() -> None:
    """Crea las tablas reales (schema.sql) en la base de prueba."""
    from django.db import connection

    host = connection.settings_dict.get("HOST") or ""
    if "supabase" in host:
        raise RuntimeError("Las pruebas no se ejecutan contra Supabase.")
    with connection.cursor() as cursor:
        cursor.execute(SCHEMA_PATH.read_text(encoding="utf-8"))


def bearer(user_id: int, role: str, *, email: str = "user@test.co", name: str = "Usuario Prueba") -> dict:
    """Cabecera Authorization para el cliente de pruebas de DRF."""
    from . import jwt_tokens

    token = jwt_tokens.issue(user_id, email, name, role, secret=TEST_JWT_SECRET,
                             issuer="reservaya-auth", minutes=30)
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}
