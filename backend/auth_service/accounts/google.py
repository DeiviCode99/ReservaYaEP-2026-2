"""Valida el ID token de "Iniciar sesión con Google" (RF-15).

Usa el endpoint tokeninfo de Google (una llamada HTTP por login), igual que el
backend anterior. Con mucho tráfico convendría verificar la firma con sus JWKS.
"""
from urllib.parse import quote

from django.conf import settings

from reservaya_common.errors import ApiError, BadRequest
from reservaya_common.http import get_json

from .rules import GoogleUser, user_from_claims

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token="
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
FAILED = "Google no pudo validar tu sesión. Intenta de nuevo."


def verify(credential: str) -> GoogleUser:
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise BadRequest("El inicio de sesión con Google no está habilitado.")
    try:
        status, claims = get_json(TOKENINFO_URL + quote(credential, safe=""), timeout=10)
    except ApiError as error:
        raise BadRequest(FAILED) from error
    if (status != 200 or not isinstance(claims, dict)
            or claims.get("aud") != client_id
            or str(claims.get("iss")) not in ISSUERS
            or str(claims.get("email_verified")).lower() != "true"
            or not claims.get("email")):
        raise BadRequest(FAILED)
    return user_from_claims(claims)
