from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from reservaya_common.drf import AllowAny, current_user, validated
from reservaya_common.errors import BadRequest, Forbidden

from . import services
from .serializers import (ForgotPasswordSerializer, GoogleSerializer, LoginSerializer,
                          RegisterSerializer, ResetPasswordSerializer)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    data = validated(RegisterSerializer, request.data)
    return Response(services.register(data["name"], data["email"], data["password"], data.get("role")), status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    data = validated(LoginSerializer, request.data)
    return Response(services.login(data["email"], data["password"]))


@api_view(["GET"])
@permission_classes([AllowAny])
def public_config(request):
    """Datos públicos para el frontend (googleClientId vacío = Google deshabilitado)."""
    return Response({"googleClientId": settings.GOOGLE_CLIENT_ID})


@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    data = validated(GoogleSerializer, request.data)
    return Response(services.google_login(data["credential"], data.get("role")))


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    data = validated(ForgotPasswordSerializer, request.data)
    services.forgot_password(data["email"])
    return Response({"message": "Si el correo está registrado, te enviamos un enlace para recuperar tu cuenta."})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    data = validated(ResetPasswordSerializer, request.data)
    return Response(services.reset_password(data["token"], data["password"]))


@api_view(["GET"])
def me(request):
    return Response(services.me(current_user(request)))


@api_view(["GET"])
def internal_users(request):
    """Nombre y correo de clientes para el panel del restaurante. Solo entre
    servicios (el gateway no enruta /internal) y con token de administrador."""
    if not current_user(request).is_admin_role:
        raise Forbidden("Solo un administrador puede consultar datos de clientes.")
    raw = ",".join(request.query_params.getlist("ids"))
    try:
        ids = sorted({int(part) for part in raw.split(",") if part.strip()})
    except ValueError as error:
        raise BadRequest("ids: debe ser una lista de números separados por coma.") from error
    return Response(services.users_by_ids(ids))
