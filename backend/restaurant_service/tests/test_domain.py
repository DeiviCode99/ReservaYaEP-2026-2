"""Reglas puras de restaurant_service (sin Django)."""
from datetime import time

import pytest

from catalog.domain import constraint_message, plan_schedule_changes, validate_schedules
from reservaya_common.errors import BadRequest


def day(n, open_t=time(12), close_t=time(22), closed=False):
    return {"dayOfWeek": n, "openTime": open_t, "closeTime": close_t, "isClosed": closed}


def test_valid_week_passes():
    validate_schedules([day(n) for n in range(1, 8)])
    validate_schedules([])
    validate_schedules(None)


def test_repeated_day():
    with pytest.raises(BadRequest, match="^El día 3 aparece repetido en el horario.$"):
        validate_schedules([day(3), day(3)])


def test_missing_hours_on_open_day():
    with pytest.raises(BadRequest, match="^Completa la hora de apertura y cierre del día 2.$"):
        validate_schedules([day(2, open_t=None)])


def test_close_must_be_after_open():
    with pytest.raises(BadRequest, match="^Día 5: el cierre debe ser después de la apertura.$"):
        validate_schedules([day(5, open_t=time(22), close_t=time(22))])


def test_closed_day_ignores_hours():
    validate_schedules([day(7, open_t=None, close_t=None, closed=True)])


def test_constraint_messages():
    assert constraint_message('duplicate key value violates unique constraint "uq_restaurants_name"') == \
        "Ya existe un restaurante con ese nombre."
    assert constraint_message('violates check constraint "ck_branches_capacity"') == \
        "La capacidad debe estar entre 1 y 500."
    assert constraint_message('violates check constraint "schedules_day_of_week_check"') == \
        "La base de datos usa días 0-6: aplica migrations/V3__schedules_iso_days.sql."
    assert constraint_message("algo raro") == \
        "Los datos chocan con una restricción de la base de datos: algo raro"


def test_plan_schedule_changes_updates_in_place():
    # Existentes: lunes(1) y martes(2). Llegan: martes y miércoles(3).
    to_update, to_create, to_delete = plan_schedule_changes({1, 2}, [day(2), day(3)])
    assert [s["dayOfWeek"] for s in to_update] == [2]
    assert [s["dayOfWeek"] for s in to_create] == [3]
    assert to_delete == {1}


def test_closed_day_without_hours_stores_midnight():
    from catalog.domain import schedule_values
    values = schedule_values(day(6, open_t=None, close_t=None, closed=True))
    assert values == {"open_time": time(0), "close_time": time(0), "is_closed": True}
    assert schedule_values(day(1))["is_closed"] is False
