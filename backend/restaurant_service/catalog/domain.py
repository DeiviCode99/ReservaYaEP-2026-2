"""Reglas puras del catálogo (marcas, sedes y horarios). Sin dependencias de Django."""
from datetime import time

from reservaya_common.errors import BadRequest

# Restricción de schema.sql (o del esquema viejo de producción) → mensaje para el usuario.
CONSTRAINT_MESSAGES = {
    "uq_restaurants_name": "Ya existe un restaurante con ese nombre.",
    "uq_branches_name_per_restaurant": "Ya existe una sede con ese nombre en este restaurante.",
    "ck_branches_capacity": "La capacidad debe estar entre 1 y 500.",
    "uq_schedules_branch_day": "Hay un día repetido en el horario.",
    "ck_schedules_range": "En cada día abierto el cierre debe ser después de la apertura.",
    "ck_schedules_day": "El día de la semana debe estar entre 1 y 7.",
    "schedules_day_of_week_check": "La base de datos usa días 0-6: aplica migrations/V3__schedules_iso_days.sql.",
    # Nombres que generó PostgreSQL en la base de producción (creada con un borrador viejo del esquema).
    "restaurants_name_key": "Ya existe un restaurante con ese nombre.",
    "branches_restaurant_id_name_key": "Ya existe una sede con ese nombre en este restaurante.",
    "branches_capacity_check": "La capacidad debe estar entre 1 y 500.",
    "schedules_branch_id_day_of_week_key": "Hay un día repetido en el horario.",
}


def validate_schedules(schedules: list[dict] | None) -> None:
    """Revisa el horario antes de tocar la BD para responder 400 con un mensaje claro.

    Cada elemento: {"dayOfWeek": 1..7, "openTime": time|None, "closeTime": time|None, "isClosed": bool}.
    """
    if not schedules:
        return
    seen = set()
    for item in schedules:
        number = item["dayOfWeek"]
        if number in seen:
            raise BadRequest(f"El día {number} aparece repetido en el horario.")
        seen.add(number)
        if item.get("isClosed"):
            continue
        if item.get("openTime") is None or item.get("closeTime") is None:
            raise BadRequest(f"Completa la hora de apertura y cierre del día {number}.")
        if not item["closeTime"] > item["openTime"]:
            raise BadRequest(f"Día {number}: el cierre debe ser después de la apertura.")


def schedule_values(item: dict) -> dict:
    """Columnas de `schedules`. Las horas son NOT NULL: un día cerrado sin horas guarda 00:00."""
    return {
        "open_time": item.get("openTime") or time(0),
        "close_time": item.get("closeTime") or time(0),
        "is_closed": bool(item.get("isClosed")),
    }


def plan_schedule_changes(existing_days: set[int], requested: list[dict]):
    """Actualizar en su sitio los días que ya existen, crear los nuevos y borrar los que no vienen.

    Borrar todo y volver a crear choca con uq_schedules_branch_day, por eso se hace así.
    Devuelve (para_actualizar, para_crear, días_a_borrar).
    """
    requested_days = {item["dayOfWeek"] for item in requested}
    to_update = [item for item in requested if item["dayOfWeek"] in existing_days]
    to_create = [item for item in requested if item["dayOfWeek"] not in existing_days]
    return to_update, to_create, set(existing_days) - requested_days


def constraint_message(detail: str) -> str:
    for name, message in CONSTRAINT_MESSAGES.items():
        if name in detail:
            return message
    return "Los datos chocan con una restricción de la base de datos: " + detail
