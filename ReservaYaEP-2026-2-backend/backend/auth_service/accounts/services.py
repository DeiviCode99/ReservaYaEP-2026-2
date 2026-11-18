"""Casos de uso de cuentas. Las vistas solo traducen HTTP ↔ estas funciones."""
import time
import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from reservaya_common import jwt_tokens
from reservaya_common.errors import BadRequest, Conflict, Unauthorized
from reservaya_common.principal import AuthenticatedUser

from . import google, mailer
from .models import User
from .passwords import check_password, hash_password
from .rules import normalize_email, self_service_role
from .tokens import create_reset, reset_matches, reset_user_id

INVALID_CREDENTIALS = "Correo o contraseña incorrectos."
INVALID_LINK = "El enlace no es válido o ya venció. Solicita uno nuevo."


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "createdAt": timezone.localtime(user.created_at).isoformat() if user.created_at else None,
    }


def session(user: User) -> dict:
    cfg = settings.RESERVAYA_JWT
    token = jwt_tokens.issue(user.id, user.email, user.name, user.role,
                             secret=cfg["SECRET"], issuer=cfg["ISSUER"], minutes=cfg["EXPIRATION_MINUTES"])
    return {"token": token, "user": user_dict(user)}


def register(name: str, email: str, password: str, role: str | None) -> dict:
    email = normalize_email(email)
    chosen_role = self_service_role(role)
    if User.objects.filter(email=email).exists():
        raise Conflict(f"Ya existe una cuenta con el correo: {email}")
    user = User(name=name.strip(), email=email, password_hash=hash_password(password), role=chosen_role)
    try:
        with transaction.atomic():
            user.save()
    except IntegrityError as error:  # doble clic: el índice único gana
        raise Conflict(f"Ya existe una cuenta con el correo: {email}") from error
    return session(user)


def login(email: str, password: str) -> dict:
    user = User.objects.filter(email=normalize_email(email)).first()
    if user is None or not check_password(password, user.password_hash):
        raise Unauthorized(INVALID_CREDENTIALS)
    return session(user)


def google_login(credential: str, role: str | None) -> dict:
    """Si ya existe una cuenta con ese correo se usa (sin cambiar su rol); si no,
    se crea con el rol elegido y una contraseña aleatoria que nadie conoce."""
    profile = google.verify(credential)
    user = User.objects.filter(email=profile.email).first()
    if user is None:
        user = User(name=profile.name, email=profile.email, role=self_service_role(role),
                    password_hash=hash_password(uuid.uuid4().hex + uuid.uuid4().hex))
        try:
            with transaction.atomic():
                user.save()
        except IntegrityError:
            user = User.objects.get(email=profile.email)
    return session(user)


def forgot_password(email: str) -> None:
    """Siempre responde igual, exista o no el correo, para no revelar cuentas."""
    user = User.objects.filter(email=normalize_email(email)).first()
    if user is None:
        return
    token = create_reset(user.id, user.password_hash, secret=settings.RESERVAYA_JWT["SECRET"],
                         ttl_seconds=settings.RESET_EXPIRATION_MINUTES * 60, now=int(time.time()))
    mailer.send_reset(user, token)


def reset_password(token: str, password: str) -> dict:
    user_id = reset_user_id(token)
    user = User.objects.filter(id=user_id).first() if user_id is not None else None
    if user is None or not reset_matches(token, user.id, user.password_hash,
                                         secret=settings.RESERVAYA_JWT["SECRET"], now=int(time.time())):
        raise BadRequest(INVALID_LINK)
    user.password_hash = hash_password(password)
    user.save()
    return session(user)


def me(principal: AuthenticatedUser) -> dict:
    user = User.objects.filter(id=principal.id).first()
    if user is None:
        raise Unauthorized(INVALID_CREDENTIALS)
    return user_dict(user)


def users_by_ids(ids: list[int]) -> list[dict]:
    return [{"id": u.id, "name": u.name, "email": u.email}
            for u in User.objects.filter(id__in=ids).order_by("id")]
