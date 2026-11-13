"""Reglas de cuenta sin dependencias de Django."""
import re
from dataclasses import dataclass

from reservaya_common.errors import BadRequest

# Mismo patrón que el backend anterior: algo@algo.tld (tld de 2+ caracteres).
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
SELF_SERVICE_ROLES = {"CLIENT", "RESTAURANT_ADMIN"}


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def valid_email(email: str) -> bool:
    return bool(EMAIL_PATTERN.match(email or ""))


def self_service_role(role: str | None) -> str:
    """Solo se puede elegir cliente o administrador de restaurante; SYSTEM_ADMIN nunca."""
    if role is None or not role.strip():
        return "CLIENT"
    value = role.strip().upper()
    if value not in SELF_SERVICE_ROLES:
        raise BadRequest("Tipo de cuenta no válido.")
    return value


@dataclass(frozen=True)
class GoogleUser:
    email: str
    name: str


def user_from_claims(claims: dict) -> GoogleUser:
    """Perfil de Google → correo en minúsculas y nombre de 2 a 80 caracteres."""
    email = str(claims["email"]).strip().lower()
    name = str(claims.get("name") or "").strip()
    if len(name) < 2:
        name = email.split("@")[0]
    return GoogleUser(email=email, name=name[:80])
