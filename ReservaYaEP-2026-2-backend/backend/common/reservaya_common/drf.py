"""Piezas de Django REST Framework compartidas: autenticación JWT, permisos,
manejador de errores y validación de cuerpos."""
import logging

import jwt
from django.conf import settings
from django.http import Http404
from rest_framework import exceptions, permissions
from rest_framework.authentication import BaseAuthentication
from rest_framework.response import Response

from . import jwt_tokens
from .errors import ApiError, error_body
from .principal import AuthenticatedUser

log = logging.getLogger(__name__)


class JWTAuthentication(BaseAuthentication):
    """Lee `Authorization: Bearer <token>`. Un token inválido o vencido equivale a
    no tener sesión: las rutas protegidas responden 401 y el frontend vuelve al login."""

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return None
        cfg = settings.RESERVAYA_JWT
        try:
            claims = jwt_tokens.decode(header[7:].strip(), secret=cfg["SECRET"], issuer=cfg["ISSUER"])
            return AuthenticatedUser.from_claims(claims), None
        except (jwt.InvalidTokenError, KeyError, ValueError):
            return None

    def authenticate_header(self, request):
        return "Bearer"  # con esto DRF responde 401 (no 403) cuando falta la sesión


class IsAuthenticated(permissions.BasePermission):
    def has_permission(self, request, view):
        return isinstance(request.user, AuthenticatedUser)


class AllowAny(permissions.AllowAny):
    pass


def current_user(request) -> AuthenticatedUser | None:
    user = request.user
    return user if isinstance(user, AuthenticatedUser) else None


def validation_message(detail) -> str:
    """{'email': ['msg']} -> 'email: msg' (como el backend anterior)."""
    if isinstance(detail, dict):
        parts = []
        for field, value in detail.items():
            text = validation_message(value)
            parts.append(text if field == "non_field_errors" else f"{field}: {text}")
        return "; ".join(parts)
    if isinstance(detail, list):
        return "; ".join(validation_message(item) for item in detail)
    return str(detail)


def exception_handler(exc, context):
    if isinstance(exc, ApiError):
        status, message = exc.status, exc.message
    elif isinstance(exc, exceptions.ValidationError):
        status, message = 400, validation_message(exc.detail)
    elif isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        status, message = 401, "Inicia sesión para continuar."
    elif isinstance(exc, exceptions.PermissionDenied):
        status, message = 403, "No tienes permiso para esta acción."
    elif isinstance(exc, (Http404, exceptions.NotFound)):
        status, message = 404, "Recurso no encontrado."
    elif isinstance(exc, exceptions.MethodNotAllowed):
        status, message = 405, "Método no permitido."
    elif isinstance(exc, exceptions.ParseError):
        status, message = 400, "El cuerpo de la petición no es un JSON válido."
    elif isinstance(exc, exceptions.APIException):
        status, message = exc.status_code, validation_message(exc.detail)
    else:
        # Red de seguridad: el detalle queda en el log, no en la respuesta.
        log.exception("Error no controlado")
        status, message = 500, "Error interno del servidor."
    response = Response(error_body(status, message), status=status)
    if status == 401:
        response["WWW-Authenticate"] = "Bearer"
    return response


def validated(serializer_class, data, **kwargs) -> dict:
    """Valida el cuerpo; si falla, DRF lanza ValidationError → 400 con el formato común."""
    serializer = serializer_class(data=data if data is not None else {}, **kwargs)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def health_view(service_name: str):
    from django.http import JsonResponse

    def view(request):
        return JsonResponse({"status": "UP", "service": service_name})
    return view
