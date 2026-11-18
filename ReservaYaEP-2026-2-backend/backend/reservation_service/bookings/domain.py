"""Reglas puras de las reservas. Sin dependencias de Django.

Ciclo de vida:
    PENDING ──► CONFIRMED ──► COMPLETED
       │            │
       ├──► REJECTED (restaurante)
       └────────────┴──► CANCELLED (cliente)
"""
import re
import unicodedata
from datetime import date, datetime, time, timedelta

STATUSES = ("PENDING", "CONFIRMED", "CANCELLED", "REJECTED", "COMPLETED")
ACTIVE = ("PENDING", "CONFIRMED")  # ocupan cupo en su franja
EVENTS = ("NONE", "ROMANTIC_DINNER", "BIRTHDAY", "WEDDING")

_RESTAURANT_TRANSITIONS = {
    "PENDING": {"CONFIRMED", "REJECTED"},
    "CONFIRMED": {"COMPLETED"},
}
_LABELS = {
    "PENDING": "pendiente",
    "CONFIRMED": "confirmada",
    "CANCELLED": "cancelada",
    "REJECTED": "rechazada",
    "COMPLETED": "completada",
}


def can_restaurant_change(previous: str, nxt: str) -> bool:
    """Transiciones que puede hacer el restaurante (RF-11)."""
    return nxt in _RESTAURANT_TRANSITIONS.get(previous, set())


def status_label(status: str) -> str:
    return _LABELS.get(status, status.lower())


def initials(value: str | None) -> str:
    """Sin tildes ni símbolos; una palabra → 3 primeras letras, varias → primera y última."""
    if value is None or not value.strip():
        return "RY"
    plain = unicodedata.normalize("NFD", value.strip())
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch))
    plain = re.sub(r"[^A-Za-z0-9 ]", " ", plain).strip().upper()
    words = plain.split()
    if not words:
        return "RY"
    if len(words) == 1:
        return words[0][:3]
    return words[0][0] + words[-1][0]


def confirmation_code(customer_name: str | None, restaurant_name: str | None, number: int) -> str:
    """Código visible de la reserva, ej. DZ-DM-123456."""
    return f"{initials(customer_name)}-{initials(restaurant_name)}-{number}"


def hourly_slots(open_t: time, close_t: time, *, day: date, today: date, now_t: time) -> list[time]:
    """Franjas de una hora desde la apertura mientras empiecen antes del cierre (RF-05).

    Fecha pasada → sin franjas; hoy → solo las que aún no empiezan.
    """
    if day < today:
        return []
    slots = []
    current = datetime.combine(day, open_t)
    close = datetime.combine(day, close_t)
    while current < close:
        if day != today or current.time() > now_t:
            slots.append(current.time())
        current += timedelta(hours=1)
        if current.date() != day:  # 23:00 + 1 h pasa a otro día: se termina
            break
    return slots


def whole_hours_between(start: datetime, end: datetime) -> int:
    """Horas completas entre dos instantes, truncadas hacia cero (como ChronoUnit.HOURS)."""
    seconds = (end - start).total_seconds()
    hours = int(abs(seconds) // 3600)
    return hours if seconds >= 0 else -hours


def match_slot(slot: time, starts: list[time]) -> time | None:
    """La franja pedida debe coincidir EXACTAMENTE con una de las ofrecidas
    (13:00:00.5 o 13:00:30 no son la franja de las 13:00)."""
    wanted = slot.replace(tzinfo=None)
    return next((start for start in starts if start == wanted), None)
