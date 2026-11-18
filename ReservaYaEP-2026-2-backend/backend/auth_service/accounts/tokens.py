"""Enlaces de recuperación de cuenta sin tabla en la base de datos (RF-16).

Token = "idUsuario.expiraEpoch.firma". La firma es HMAC-SHA256 sobre el id, la
expiración y el hash ACTUAL de la contraseña, con la clave
"password-reset:" + JWT_SECRET. Al cambiar la contraseña el hash cambia y el
enlace deja de servir: es de un solo uso. Mismo formato que el backend Spring.
"""
import base64
import hashlib
import hmac


def _sign(user_id: int, expires: int, password_hash: str, secret: str) -> str:
    key = ("password-reset:" + secret).encode("utf-8")
    message = f"{user_id}|{expires}|{password_hash}".encode("utf-8")
    digest = hmac.new(key, message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def create_reset(user_id: int, password_hash: str, *, secret: str, ttl_seconds: int, now: int) -> str:
    expires = now + ttl_seconds
    return f"{user_id}.{expires}.{_sign(user_id, expires, password_hash, secret)}"


def reset_user_id(token: str) -> int | None:
    """Id al que dice pertenecer el token (todavía sin validar la firma)."""
    parts = (token or "").split(".")
    if len(parts) != 3:
        return None
    try:
        return int(parts[0])
    except ValueError:
        return None


def reset_matches(token: str, user_id: int, password_hash: str, *, secret: str, now: int) -> bool:
    parts = (token or "").split(".")
    if len(parts) != 3 or parts[0] != str(user_id):
        return False
    try:
        expires = int(parts[1])
    except ValueError:
        return False
    if now > expires:
        return False
    expected = _sign(user_id, expires, password_hash, secret)
    return hmac.compare_digest(expected.encode("utf-8"), parts[2].encode("utf-8"))
