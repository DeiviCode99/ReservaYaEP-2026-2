"""Reglas puras de reservas (sin Django)."""
from datetime import date, datetime, time
from itertools import product

from bookings.domain import (ACTIVE, STATUSES, can_restaurant_change, confirmation_code, hourly_slots, initials,
                             status_label, whole_hours_between)

DAY = date(2026, 12, 1)
TODAY = date(2026, 11, 20)


def test_initials():
    assert initials("Juan Rangel") == "JR"
    assert initials("David Alejandro Zapata") == "DZ"
    assert initials("Ánfora") == "ANF"
    assert initials("Crepes & Waffles") == "CW"
    assert initials("Li") == "LI"
    assert initials("") == "RY"
    assert initials(None) == "RY"
    assert initials("  ") == "RY"


def test_confirmation_code():
    assert confirmation_code("David Zapata", "Doña Marta", 123456) == "DZ-DM-123456"


def test_restaurant_transitions():
    allowed = {("PENDING", "CONFIRMED"), ("PENDING", "REJECTED"), ("CONFIRMED", "COMPLETED")}
    for prev, nxt in product(STATUSES, STATUSES):
        assert can_restaurant_change(prev, nxt) == ((prev, nxt) in allowed), (prev, nxt)


def test_active_statuses():
    assert ACTIVE == ("PENDING", "CONFIRMED")


def test_hourly_slots_future_day():
    assert hourly_slots(time(12), time(15), day=DAY, today=TODAY, now_t=time(9)) == [time(12), time(13), time(14)]


def test_hourly_slots_closing_after_last_full_hour_ends():
    assert hourly_slots(time(22), time(23, 30), day=DAY, today=TODAY, now_t=time(9)) == [time(22), time(23)]


def test_hourly_slots_close_before_open_is_empty():
    assert hourly_slots(time(23), time(0), day=DAY, today=TODAY, now_t=time(9)) == []


def test_hourly_slots_today_only_future_slots():
    assert hourly_slots(time(12), time(15), day=TODAY, today=TODAY, now_t=time(13, 10)) == [time(14)]
    # una franja que empieza exactamente ahora ya no se ofrece
    assert hourly_slots(time(12), time(15), day=TODAY, today=TODAY, now_t=time(13)) == [time(14)]


def test_hourly_slots_past_day_is_empty():
    assert hourly_slots(time(12), time(15), day=date(2026, 11, 19), today=TODAY, now_t=time(9)) == []


def test_hourly_slots_open_on_half_hour():
    assert hourly_slots(time(12, 30), time(14, 30), day=DAY, today=TODAY, now_t=time(9)) == [time(12, 30), time(13, 30)]


def test_whole_hours_between_truncates():
    start = datetime(2026, 11, 20, 10, 0)
    assert whole_hours_between(start, datetime(2026, 11, 20, 11, 59)) == 1
    assert whole_hours_between(start, datetime(2026, 11, 20, 12, 0)) == 2
    assert whole_hours_between(start, datetime(2026, 11, 20, 9, 30)) == 0  # -0.5 h → 0, como ChronoUnit.HOURS
    assert whole_hours_between(start, datetime(2026, 11, 20, 8, 0)) == -2


def test_status_labels():
    assert [status_label(s) for s in STATUSES] == ["pendiente", "confirmada", "cancelada", "rechazada", "completada"]


def test_match_slot_requires_exact_time():
    from bookings.domain import match_slot
    starts = [time(12), time(13), time(14)]
    assert match_slot(time(13), starts) == time(13)
    assert match_slot(time(13, 0, 0, 500000), starts) is None  # "13:00:00.5" no es la franja de las 13:00
    assert match_slot(time(13, 0, 30), starts) is None
    assert match_slot(time(18), starts) is None
