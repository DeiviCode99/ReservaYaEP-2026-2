"""Pruebas HTTP de reservation_service contra PostgreSQL local (requieren Django).

Los otros servicios se simulan: restaurant_service (sede 7 de la marca 1, aforo 10,
abierta 12:00–15:00 salvo el día siguiente a NEXT_WEEK) y auth_service.
"""
from datetime import date, datetime, time, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

import pytest
from django.db import connection
from rest_framework.test import APIClient

from bookings.models import Reservation, ReservationAudit
from reservaya_common.errors import Unavailable
from reservaya_common.testing import bearer

pytestmark = pytest.mark.django_db
ZONE = ZoneInfo("America/Bogota")
NOW = datetime(2026, 11, 20, 9, 0, tzinfo=ZONE)
NEXT_WEEK = NOW.date() + timedelta(days=7)
CLOSED_DAY = NEXT_WEEK + timedelta(days=1)


def branch_payload(active=True):
    schedules = [{"id": d, "dayOfWeek": d, "openTime": "12:00:00", "closeTime": "15:00:00",
                  "isClosed": d == CLOSED_DAY.isoweekday()} for d in range(1, 8)]
    return {"id": 7, "restaurantId": 1, "restaurantName": "Doña Marta", "capacity": 10, "active": active,
            "schedules": schedules}


@pytest.fixture
def ids():
    """Usuarios reales (FK) y la sede 7 (FK de reservations → branches)."""
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO users (name, email, password_hash, role) VALUES "
                       "('Ana Gómez','ana@test.co','x','CLIENT'), ('Leo Ruiz','leo@test.co','x','CLIENT'), "
                       "('Dueño','dueno@test.co','x','RESTAURANT_ADMIN'), ('Otro','otro@test.co','x','RESTAURANT_ADMIN'), "
                       "('Root','root@test.co','x','SYSTEM_ADMIN') RETURNING id")
        ana, leo, owner, other, root = [row[0] for row in cursor.fetchall()]
        cursor.execute("INSERT INTO restaurants (id, name, cuisine_type) VALUES (1, 'Doña Marta', 'Colombiana')")
        cursor.execute("INSERT INTO branches (id, restaurant_id, name, address, city, capacity) "
                       "VALUES (7, 1, 'Sede', 'Cl 1', 'Bucaramanga', 10)")
    return {"ana": ana, "leo": leo, "owner": owner, "other": other, "root": root}


@pytest.fixture(autouse=True)
def services_mock(ids):
    with mock.patch("bookings.clients.get_branch", side_effect=lambda branch_id: branch_payload()) as get_branch, \
            mock.patch("bookings.clients.is_admin_of", side_effect=lambda uid, rid: uid == ids["owner"]), \
            mock.patch("bookings.clients.users_by_ids",
                       return_value={ids["ana"]: {"id": ids["ana"], "name": "Ana Gómez", "email": "ana@test.co"}}), \
            mock.patch("bookings.availability.now_local", return_value=NOW), \
            mock.patch("bookings.serializers.now_local", return_value=NOW), \
            mock.patch("bookings.notifier.notify_customer") as notify:
        yield {"get_branch": get_branch, "notify": notify}


@pytest.fixture
def api():
    return APIClient()


def as_user(ids, who, role=None):
    roles = {"ana": "CLIENT", "leo": "CLIENT", "owner": "RESTAURANT_ADMIN", "other": "RESTAURANT_ADMIN"}
    return bearer(ids[who], role or roles[who], email=f"{who}@test.co",
                  name={"ana": "Ana Gómez", "leo": "Leo Ruiz"}.get(who, "Dueño"))


def book(api, ids, who="ana", day=NEXT_WEEK, hour="13:00", people=2, **extra):
    body = {"branchId": 7, "reservationDate": day.isoformat(), "reservationTime": hour, "partySize": people, **extra}
    return api.post("/api/reservations", body, format="json", **as_user(ids, who))


def make(ids, who="ana", day=NEXT_WEEK, hour=13, people=2, status="PENDING", code=None):
    return Reservation.objects.create(user_id=ids[who], customer_email=f"{who}@test.co", branch_id=7,
                                      reservation_date=day, reservation_time=time(hour), party_size=people,
                                      status=status, confirmation_code=code or f"T-{who}-{hour}-{status}")


# ------------------------------------------------------------ disponibilidad

def test_availability_lists_hourly_slots_with_remaining_capacity(api, ids):
    make(ids, people=4)
    make(ids, who="leo", people=3, status="CANCELLED")  # cancelada: no ocupa cupo
    response = api.get(f"/api/reservations/availability?branchId=7&date={NEXT_WEEK}")  # pública
    assert response.status_code == 200
    assert response.json() == {"branchId": 7, "date": NEXT_WEEK.isoformat(), "capacity": 10, "slots": [
        {"time": "12:00:00", "available": 10}, {"time": "13:00:00", "available": 6},
        {"time": "14:00:00", "available": 10}]}


def test_availability_empty_for_closed_day_and_past_date(api):
    assert api.get(f"/api/reservations/availability?branchId=7&date={CLOSED_DAY}").json()["slots"] == []
    past = NOW.date() - timedelta(days=1)
    assert api.get(f"/api/reservations/availability?branchId=7&date={past}").json()["slots"] == []


def test_availability_inactive_branch_404(api, services_mock):
    services_mock["get_branch"].side_effect = lambda branch_id: branch_payload(active=False)
    response = api.get(f"/api/reservations/availability?branchId=7&date={NEXT_WEEK}")
    assert response.status_code == 404
    assert response.json()["message"] == "La sede no está activa."


# ------------------------------------------------------------------- crear

def test_create_reservation(api, ids):
    response = book(api, ids, event="BIRTHDAY")
    assert response.status_code == 201, response.json()
    body = response.json()
    assert set(body) == {"id", "userId", "branchId", "reservationDate", "reservationTime", "partySize", "event",
                         "confirmationCode", "status", "cancellationReason", "createdAt", "updatedAt",
                         "customerName", "customerEmail"}
    assert body["status"] == "PENDING"
    assert body["reservationTime"] == "13:00:00"
    assert body["event"] == "BIRTHDAY"
    assert body["confirmationCode"].startswith("AG-DM-")
    assert Reservation.objects.get(id=body["id"]).customer_email == "ana@test.co"
    assert ReservationAudit.objects.filter(reservation_id=body["id"], action="CREATED").exists()


def test_create_rejects_when_capacity_exceeded(api, ids):
    make(ids, who="leo", people=8)
    response = book(api, ids, people=3)
    assert response.status_code == 409
    assert response.json()["message"] == "No hay cupo suficiente. Disponible: 2 personas."


def test_create_rejects_time_outside_schedule(api, ids):
    response = book(api, ids, hour="18:00")
    assert response.status_code == 422
    assert response.json()["message"] == "La sede no atiende a esa hora o la franja ya pasó."


def test_create_rejects_fractional_second_time(api, ids):
    """Una hora como 13:00:00.5 no es la franja de las 13:00: no puede saltarse el aforo."""
    make(ids, who="leo", people=10)  # franja de las 13:00 llena
    for hour in ("13:00:00.5", "13:00:30"):
        response = book(api, ids, hour=hour)
        assert response.status_code == 422, hour
        assert response.json()["message"] == "La sede no atiende a esa hora o la franja ya pasó."
    assert Reservation.objects.filter(user_id=ids["ana"]).count() == 0


def test_create_rejects_past_date_and_bad_party(api, ids):
    assert book(api, ids, day=NOW.date() - timedelta(days=1)).status_code == 400
    assert book(api, ids, people=51).status_code == 400
    assert book(api, ids, event="FIESTA").status_code == 400


def test_duplicate_active_reservation_same_slot(api, ids):
    assert book(api, ids).status_code == 201
    response = book(api, ids)
    assert response.status_code == 409
    assert response.json()["message"] == "Ya existe una reserva activa en esa franja horaria."


def test_duplicate_slot_rejected_even_without_db_index(api, ids):
    """La base de producción no tiene el índice uq_reservations_active_slot: el servicio lo valida."""
    with connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS uq_reservations_active_slot")  # se revierte al final de la prueba
    assert book(api, ids).status_code == 201
    response = book(api, ids)
    assert response.status_code == 409
    assert response.json()["message"] == "Ya existe una reserva activa en esa franja horaria."
    assert Reservation.objects.filter(user_id=ids["ana"]).count() == 1
    # Modificar otra reserva propia hacia esa misma franja también se rechaza.
    other = make(ids, hour=14)
    body = {"branchId": 7, "reservationDate": NEXT_WEEK.isoformat(), "reservationTime": "13:00", "partySize": 2}
    assert api.put(f"/api/reservations/{other.id}", body, format="json", **as_user(ids, "ana")).status_code == 409


def test_restaurant_down_returns_503(api, ids, services_mock):
    services_mock["get_branch"].side_effect = Unavailable("Un servicio interno no está disponible.")
    response = book(api, ids)
    assert response.status_code == 503
    assert response.json()["message"] == "Un servicio interno no está disponible."


def test_create_requires_session(api):
    response = api.post("/api/reservations", {}, format="json")
    assert response.status_code == 401


# --------------------------------------------------------- ver / modificar

def test_my_reservations_newest_first(api, ids):
    make(ids, day=NEXT_WEEK, hour=12)
    make(ids, day=NEXT_WEEK + timedelta(days=2), hour=13)
    make(ids, who="leo", hour=14)
    body = api.get("/api/reservations", **as_user(ids, "ana")).json()
    assert [(r["reservationDate"], r["reservationTime"]) for r in body] == [
        ((NEXT_WEEK + timedelta(days=2)).isoformat(), "13:00:00"), (NEXT_WEEK.isoformat(), "12:00:00")]
    assert body[0]["customerName"] is None


def test_modify_same_slot_counts_own_seats(api, ids):
    mine = make(ids, people=4)
    make(ids, who="leo", people=6)  # franja llena: 4 + 6 = 10
    body = {"branchId": 7, "reservationDate": NEXT_WEEK.isoformat(), "reservationTime": "13:00:00", "partySize": 4}
    response = api.put(f"/api/reservations/{mine.id}", body, format="json", **as_user(ids, "ana"))
    assert response.status_code == 200, response.json()
    body["partySize"] = 5
    response = api.put(f"/api/reservations/{mine.id}", body, format="json", **as_user(ids, "ana"))
    assert response.status_code == 409
    assert response.json()["message"] == "No hay cupo suficiente. Disponible: 4 personas."


def test_modify_goes_back_to_pending_and_notifies(api, ids, services_mock):
    mine = make(ids, status="CONFIRMED")
    body = {"branchId": 7, "reservationDate": NEXT_WEEK.isoformat(), "reservationTime": "14:00", "partySize": 3}
    response = api.put(f"/api/reservations/{mine.id}", body, format="json", **as_user(ids, "ana"))
    assert response.json()["status"] == "PENDING"
    assert response.json()["reservationTime"] == "14:00:00"
    services_mock["notify"].assert_called_once()


def test_cancel_rules(api, ids):
    soon = make(ids, day=NOW.date(), hour=10, code="SOON")  # empieza en 1 h
    response = api.patch(f"/api/reservations/{soon.id}", {}, format="json", **as_user(ids, "ana"))
    assert response.status_code == 422
    assert response.json()["message"] == "No se puede cancelar con menos de 2 horas de anticipación."

    other = make(ids, who="leo")
    response = api.patch(f"/api/reservations/{other.id}", {}, format="json", **as_user(ids, "ana"))
    assert response.status_code == 422
    assert response.json()["message"] == "No puedes cancelar una reserva que no es tuya."

    mine = make(ids)
    response = api.patch(f"/api/reservations/{mine.id}", {"cancellationReason": "Viaje"}, format="json",
                         **as_user(ids, "ana"))
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
    assert response.json()["cancellationReason"] == "Viaje"
    again = api.patch(f"/api/reservations/{mine.id}", {}, format="json", **as_user(ids, "ana"))
    assert again.json()["message"] == "Solo se pueden cancelar reservas pendientes o confirmadas."

    assert api.patch(f"/api/reservations/{mine.id}", {}, format="json",
                     **as_user(ids, "owner")).status_code == 403


# ------------------------------------------------------------- restaurante

def test_owner_sees_day_sorted_with_customer_data(api, ids):
    late, early = make(ids, hour=14), make(ids, hour=12)
    body = api.get(f"/api/reservations?branchId=7&date={NEXT_WEEK}", **as_user(ids, "owner")).json()
    assert [r["id"] for r in body] == [early.id, late.id]
    assert body[0]["customerName"] == "Ana Gómez"
    assert body[0]["customerEmail"] == "ana@test.co"


def test_owner_range_and_status_filters(api, ids):
    make(ids, hour=12, status="PENDING")
    make(ids, hour=13, status="CONFIRMED")
    url = f"/api/reservations?branchId=7&from={NEXT_WEEK}&to={NEXT_WEEK + timedelta(days=2)}&status=pending"
    assert [r["status"] for r in api.get(url, **as_user(ids, "owner")).json()] == ["PENDING"]
    bad = api.get(f"/api/reservations?branchId=7&from={NEXT_WEEK}&to={NOW.date()}", **as_user(ids, "owner"))
    assert bad.status_code == 422
    assert api.get(f"/api/reservations?date={NEXT_WEEK}", **as_user(ids, "ana")).status_code == 422
    assert api.get("/api/reservations?branchId=7", **as_user(ids, "owner")).status_code == 422


def test_only_branch_owner_sees_or_changes(api, ids):
    r = make(ids)
    assert api.get(f"/api/reservations?branchId=7&date={NEXT_WEEK}", **as_user(ids, "other")).status_code == 403
    assert api.get(f"/api/reservations?branchId=7&date={NEXT_WEEK}", **as_user(ids, "ana")).status_code == 403
    response = api.patch(f"/api/reservations/{r.id}/status", {"status": "CONFIRMED"}, format="json",
                         **as_user(ids, "other"))
    assert response.status_code == 403
    assert response.json()["message"] == "No administras esta sede."


def test_restaurant_status_lifecycle(api, ids, services_mock):
    owner = as_user(ids, "owner")
    r = make(ids)
    assert api.patch(f"/api/reservations/{r.id}/status", {"status": "confirmed"}, format="json",
                     **owner).json()["status"] == "CONFIRMED"
    assert api.patch(f"/api/reservations/{r.id}/status", {"status": "COMPLETED"}, format="json",
                     **owner).json()["status"] == "COMPLETED"
    back = api.patch(f"/api/reservations/{r.id}/status", {"status": "PENDING"}, format="json", **owner)
    assert back.status_code == 422
    assert back.json()["message"] == "Una reserva COMPLETED no puede pasar a PENDING."

    r2 = make(ids, hour=14)
    rejected = api.patch(f"/api/reservations/{r2.id}/status",
                         {"status": "REJECTED", "cancellationReason": "  Sede cerrada por evento  "},
                         format="json", **owner).json()
    assert (rejected["status"], rejected["cancellationReason"]) == ("REJECTED", "Sede cerrada por evento")
    assert ReservationAudit.objects.filter(action="STATUS_CHANGED").count() == 3
    assert services_mock["notify"].call_count == 3

    r3 = make(ids, hour=12)
    assert api.patch(f"/api/reservations/{r3.id}/status", {"status": "COMPLETED"}, format="json",
                     **owner).status_code == 422
    unknown = api.patch(f"/api/reservations/{r3.id}/status", {"status": "VOLANDO"}, format="json", **owner)
    assert unknown.status_code == 422
    assert unknown.json()["message"] == "Estado de reserva no válido: VOLANDO"


def test_system_admin_can_manage_any_branch(api, ids):
    r = make(ids)
    root = bearer(ids["root"], "SYSTEM_ADMIN")
    assert api.patch(f"/api/reservations/{r.id}/status", {"status": "CONFIRMED"}, format="json",
                     **root).json()["status"] == "CONFIRMED"


def test_lock_slot_runs_in_postgres():
    from django.db import transaction
    from bookings.availability import lock_slot
    with transaction.atomic():
        lock_slot(7, date(2026, 12, 1), time(13))
