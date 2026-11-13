"""Envía el enlace de recuperación de cuenta (RF-16).

Sin EMAIL_HOST (típico en desarrollo) el enlace se escribe en el log del
servicio para poder probar el flujo.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

log = logging.getLogger(__name__)


def reset_link(token: str) -> str:
    return settings.FRONTEND_ORIGIN.rstrip("/") + "/recuperar?token=" + token


def send_reset(user, token: str) -> None:
    link = reset_link(token)
    if not settings.EMAIL_HOST:
        log.warning("Correo sin configurar. Enlace de recuperación para %s: %s", user.email, link)
        return
    body = (
        f"Hola, {user.name}.\n\n"
        "Recibimos una solicitud para cambiar la contraseña de tu cuenta de ReservaYa.\n"
        f"Abre este enlace para elegir una nueva (vence en {settings.RESET_EXPIRATION_MINUTES} minutos):\n\n"
        f"{link}\n\n"
        "Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando."
    )
    try:
        send_mail("Recupera tu cuenta de ReservaYa", body, settings.DEFAULT_FROM_EMAIL, [user.email])
    except Exception:  # noqa: BLE001 — no se informa al cliente para no revelar qué correos existen
        log.exception("No se pudo enviar el correo de recuperación a %s", user.email)
