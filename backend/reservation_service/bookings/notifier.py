"""Notificaciones por correo al cliente. Sin EMAIL_HOST se escriben en el log."""
import logging

from django.conf import settings
from django.core.mail import send_mail

log = logging.getLogger(__name__)


def notify_customer(reservation, subject: str, message: str) -> None:
    recipient = reservation.customer_email
    if not recipient:
        log.warning("No se puede notificar la reserva %s: no tiene correo de cliente.", reservation.id)
        return
    if not settings.EMAIL_HOST:
        log.info("Correo sin configurar. Notificación para %s: %s", recipient, message)
        return
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [recipient])
    except Exception:  # noqa: BLE001 — la reserva ya quedó guardada; el correo no la revierte
        log.exception("No se pudo enviar la notificación de la reserva %s.", reservation.id)
