"""Disponibilidad por franja (RF-05) y cupo (RF-07)."""
from datetime import date, time

from django.db import connection
from django.utils import timezone

from reservaya_common.errors import NotFound, Unprocessable

from .domain import ACTIVE, hourly_slots


def now_local():
    """Hora actual en America/Bogota (las pruebas la reemplazan)."""
    return timezone.localtime()


def _time(value: str | None) -> time | None:
    return time.fromisoformat(value) if value else None


def occupied_by_slot(branch_id: int, day: date) -> dict[time, int]:
    """Personas en reservas activas por franja, en una sola consulta
    (usa idx_reservations_branch_date)."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT reservation_time, SUM(party_size) FROM reservations "
            "WHERE branch_id = %s AND reservation_date = %s AND status = ANY(%s) "
            "GROUP BY reservation_time",
            [branch_id, day, list(ACTIVE)],
        )
        return {row[0]: int(row[1]) for row in cursor.fetchall()}


def lock_slot(branch_id: int, day: date, slot: time) -> None:
    """Bloqueo consultivo de PostgreSQL por (sede, fecha, hora) hasta el fin de la
    transacción: dos reservas simultáneas de la misma franja se atienden en orden y
    no pueden superar el aforo. Debe llamarse dentro de transaction.atomic()."""
    key = f"{int(branch_id)}|{day.isoformat()}|{slot.strftime('%H:%M:%S')}"
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", [key])


def compute(branch: dict, day: date) -> dict:
    """{branchId, date, capacity, slots: [{time, available}]} a partir de los datos de la sede."""
    if not branch.get("active"):
        raise NotFound("La sede no está activa.")
    capacity = int(branch["capacity"])
    result = {"branchId": branch["id"], "date": day.isoformat(), "capacity": capacity, "slots": []}
    schedule = next((s for s in branch.get("schedules") or [] if s.get("dayOfWeek") == day.isoweekday()), None)
    if schedule is None or schedule.get("isClosed"):
        return result
    now = now_local()
    starts = hourly_slots(_time(schedule["openTime"]), _time(schedule["closeTime"]),
                          day=day, today=now.date(), now_t=now.time().replace(tzinfo=None))
    if not starts:
        return result
    occupied = occupied_by_slot(branch["id"], day)
    result["slots"] = [{"time": slot.strftime("%H:%M:%S"), "available": max(capacity - occupied.get(slot, 0), 0)}
                       for slot in starts]
    return result


def seats_in_slot(branch: dict, day: date, slot: time) -> int:
    """Cupo de la franja pedida, con las mismas franjas que ve el cliente."""
    wanted = slot.strftime("%H:%M:%S")
    for item in compute(branch, day)["slots"]:
        if item["time"] == wanted:
            return item["available"]
    raise Unprocessable("La sede no atiende a esa hora o la franja ya pasó.")
