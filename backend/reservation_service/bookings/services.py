"""Casos de uso de las reservas.

Cliente: crear (RF-06/07), ver las suyas (RF-08), modificar y cancelar (RF-09).
Restaurante: ver las de su sede (RF-10) y aceptarlas, rechazarlas o completarlas (RF-11).
"""
import secrets
from datetime import date, datetime

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from reservaya_common.errors import Conflict, Forbidden, NotFound, Unprocessable
from reservaya_common.principal import AuthenticatedUser

from . import availability, clients, notifier
from .domain import STATUSES, can_restaurant_change, confirmation_code, status_label, whole_hours_between
from .models import Reservation, ReservationAudit

DUPLICATE_SLOT = "Ya existe una reserva activa en esa franja horaria."


# ------------------------------------------------------------ representación

def reservation_dict(r: Reservation, customer: dict | None = None) -> dict:
    """customerName y customerEmail solo se llenan en el panel del restaurante."""
    return {
        "id": r.id,
        "userId": r.user_id,
        "branchId": r.branch_id,
        "reservationDate": r.reservation_date.isoformat(),
        "reservationTime": r.reservation_time.strftime("%H:%M:%S"),
        "partySize": r.party_size,
        "event": r.event,
        "confirmationCode": r.confirmation_code,
        "status": r.status,
        "cancellationReason": r.cancellation_reason,
        "createdAt": timezone.localtime(r.created_at).isoformat() if r.created_at else None,
        "updatedAt": timezone.localtime(r.updated_at).isoformat() if r.updated_at else None,
        "customerName": customer.get("name") if customer else None,
        "customerEmail": customer.get("email") if customer else None,
    }


def _audit(r: Reservation, actor: AuthenticatedUser, action: str, previous: str | None, details: str | None):
    ReservationAudit.objects.create(reservation_id=r.id, actor_user_id=actor.id, actor_role=actor.role,
                                    action=action, previous_status=previous, new_status=r.status,
                                    details=(details or None) and details[:255])


def _require_seats(party_size: int, available: int) -> None:
    if available < party_size:
        raise Conflict(f"No hay cupo suficiente. Disponible: {available} personas.")


def _apply(r: Reservation, data: dict) -> None:
    r.branch_id = data["branchId"]
    r.reservation_date = data["reservationDate"]
    r.reservation_time = data["reservationTime"]
    r.party_size = data["partySize"]
    r.event = data.get("event") or "NONE"
    r.status = "PENDING"


def _is_duplicate_slot(error: IntegrityError) -> bool:
    return "uq_reservations_active_slot" in str(error)


# ------------------------------------------------------------------ cliente

def availability_for(branch_id: int, day: date) -> dict:
    return availability.compute(clients.get_branch(branch_id), day)


def create(data: dict, user: AuthenticatedUser) -> dict:
    branch = clients.get_branch(data["branchId"])  # HTTP fuera de la transacción
    for _ in range(5):  # el código aleatorio podría repetirse: se reintenta
        try:
            with transaction.atomic():
                availability.lock_slot(data["branchId"], data["reservationDate"], data["reservationTime"])
                _require_seats(data["partySize"], availability.seats_in_slot(
                    branch, data["reservationDate"], data["reservationTime"]))
                r = Reservation(user_id=user.id, customer_email=user.email,
                                confirmation_code=confirmation_code(user.name, branch.get("restaurantName"),
                                                                    secrets.randbelow(900000) + 100000))
                _apply(r, data)
                r.save()
                _audit(r, user, "CREATED", None, "Reserva creada por el cliente.")
                return reservation_dict(r)
        except IntegrityError as error:
            if _is_duplicate_slot(error):
                raise Conflict(DUPLICATE_SLOT) from error
            if "confirmation_code" not in str(error):
                raise
    raise Conflict("No se pudo generar el código de la reserva. Intenta de nuevo.")


def my_reservations(user: AuthenticatedUser) -> list[dict]:
    query = Reservation.objects.filter(user_id=user.id).order_by("-reservation_date", "-reservation_time")
    return [reservation_dict(r) for r in query]


def _find_changeable(reservation_id: int, user: AuthenticatedUser, action: str) -> Reservation:
    """Reglas comunes de RF-09: reserva propia, activa y con la anticipación mínima."""
    if user.role != "CLIENT":
        raise Forbidden(f"Solo el cliente puede {action} sus reservas.")
    r = Reservation.objects.select_for_update().filter(id=reservation_id).first()
    if r is None:
        raise NotFound("Reserva no encontrada.")
    if r.user_id != user.id:
        raise Unprocessable(f"No puedes {action} una reserva que no es tuya.")
    if r.status not in ("PENDING", "CONFIRMED"):
        raise Unprocessable(f"Solo se pueden {action} reservas pendientes o confirmadas.")
    starts_at = datetime.combine(r.reservation_date, r.reservation_time)
    now = availability.now_local().replace(tzinfo=None)
    minimum = settings.MIN_HOURS_BEFORE_CANCEL
    if whole_hours_between(now, starts_at) < minimum:
        raise Unprocessable(f"No se puede {action} con menos de {minimum} horas de anticipación.")
    return r


def update(reservation_id: int, data: dict, user: AuthenticatedUser) -> dict:
    """RF-09: cambia sede, fecha, hora o personas; vuelve a PENDING porque el
    restaurante debe aceptar el nuevo horario."""
    branch = clients.get_branch(data["branchId"])
    try:
        with transaction.atomic():
            r = _find_changeable(reservation_id, user, "modificar")
            previous = r.status
            availability.lock_slot(data["branchId"], data["reservationDate"], data["reservationTime"])
            same_slot = (r.branch_id == data["branchId"] and r.reservation_date == data["reservationDate"]
                         and r.reservation_time == data["reservationTime"])
            own_seats = r.party_size if same_slot else 0  # sus propios puestos cuentan como libres
            _require_seats(data["partySize"], availability.seats_in_slot(
                branch, data["reservationDate"], data["reservationTime"]) + own_seats)
            _apply(r, data)
            r.save()
            _audit(r, user, "MODIFIED", previous,
                   "Fecha, hora, sede o número de personas modificados por el cliente.")
    except IntegrityError as error:
        if _is_duplicate_slot(error):
            raise Conflict(DUPLICATE_SLOT) from error
        raise
    notifier.notify_customer(r, "Reserva modificada",
                             f"Tu reserva #{r.id} fue modificada y quedó pendiente de confirmación.")
    return reservation_dict(r)


def cancel(reservation_id: int, reason: str | None, user: AuthenticatedUser) -> dict:
    with transaction.atomic():
        r = _find_changeable(reservation_id, user, "cancelar")
        previous = r.status
        r.status = "CANCELLED"
        r.cancellation_reason = reason
        r.save()
        _audit(r, user, "CANCELLED", previous, reason)
    notifier.notify_customer(r, "Reserva cancelada", f"Tu reserva #{r.id} fue cancelada correctamente.")
    return reservation_dict(r)


# -------------------------------------------------------------- restaurante

def require_branch_admin(branch_id: int, user: AuthenticatedUser) -> None:
    """Solo quien administra la marca dueña de la sede (o un SYSTEM_ADMIN)."""
    if user.role == "SYSTEM_ADMIN":
        return
    if user.role != "RESTAURANT_ADMIN":
        raise Forbidden("Solo el restaurante puede gestionar las reservas de sus sedes.")
    restaurant_id = clients.get_branch(branch_id)["restaurantId"]
    if not clients.is_admin_of(user.id, restaurant_id):
        raise Forbidden("No administras esta sede.")


def parse_status(value: str) -> str:
    status = (value or "").strip().upper()
    if status not in STATUSES:
        raise Unprocessable(f"Estado de reserva no válido: {value}")
    return status


def branch_reservations(branch_id: int, start: date | None, end: date | None, status: str | None,
                        user: AuthenticatedUser, authorization: str) -> list[dict]:
    require_branch_admin(branch_id, user)
    if start is None and end is None:
        raise Unprocessable("Indica una fecha o un rango de fechas.")
    start, end = start or end, end or start  # con una sola fecha se consulta ese día
    if start > end:
        raise Unprocessable("La fecha inicial no puede ser posterior a la fecha final.")
    statuses = list(STATUSES) if not status or not status.strip() else [parse_status(status)]
    reservations = list(Reservation.objects.filter(branch_id=branch_id, reservation_date__range=(start, end),
                                                   status__in=statuses)
                        .order_by("reservation_date", "reservation_time", "id"))
    customers = clients.users_by_ids({r.user_id for r in reservations}, authorization)
    return [reservation_dict(r, customers.get(r.user_id)) for r in reservations]


def update_status(reservation_id: int, status: str, reason: str | None, user: AuthenticatedUser) -> dict:
    r = Reservation.objects.filter(id=reservation_id).first()
    if r is None:
        raise NotFound("Reserva no encontrada.")
    require_branch_admin(r.branch_id, user)
    nxt = parse_status(status)
    with transaction.atomic():
        r = Reservation.objects.select_for_update().get(id=reservation_id)
        previous = r.status
        if not can_restaurant_change(previous, nxt):
            raise Unprocessable(f"Una reserva {previous} no puede pasar a {nxt}.")
        r.status = nxt
        if reason and reason.strip():
            r.cancellation_reason = reason.strip()
        r.save()
        _audit(r, user, "STATUS_CHANGED", previous, reason)
    notifier.notify_customer(r, "Estado de reserva actualizado",
                             f"El estado de tu reserva #{r.id} cambió de {status_label(previous)} "
                             f"a {status_label(nxt)}.")
    return reservation_dict(r)
