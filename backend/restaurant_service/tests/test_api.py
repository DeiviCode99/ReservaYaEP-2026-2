"""Pruebas HTTP de restaurant_service contra PostgreSQL local (requieren Django)."""
import pytest
from django.db import connection
from rest_framework.test import APIClient

from catalog.models import Branch, Restaurant, RestaurantAdmin, Schedule
from reservaya_common.testing import bearer

pytestmark = pytest.mark.django_db


def make_user(email, role="RESTAURANT_ADMIN"):
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, 'x', %s) RETURNING id",
                       ["Usuario " + email[:3], email, role])
        return cursor.fetchone()[0]


def week(open_t="12:00", close_t="22:00"):
    return [{"dayOfWeek": d, "openTime": open_t, "closeTime": close_t, "isClosed": False} for d in range(1, 8)]


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner():
    return make_user("dueno@test.co")


@pytest.fixture
def restaurant(api, owner):
    response = api.post("/api/restaurants", {"name": "Doña Marta", "cuisineType": "Colombiana"}, format="json",
                        **bearer(owner, "RESTAURANT_ADMIN"))
    assert response.status_code == 201, response.json()
    return response.json()


def branch_body(name="Sede Cabecera", city="Bucaramanga", schedules=None, **extra):
    return {"name": name, "address": "Calle 1 # 2-3", "city": city, "capacity": 20,
            "schedules": week() if schedules is None else schedules, **extra}


def test_create_restaurant_links_admin(restaurant, owner):
    assert set(restaurant) == {"id", "name", "cuisineType", "description", "logoUrl", "createdAt", "updatedAt"}
    assert RestaurantAdmin.objects.filter(user_id=owner, restaurant_id=restaurant["id"]).exists()


def test_client_cannot_register_restaurant(api):
    client = make_user("cli@test.co", "CLIENT")
    response = api.post("/api/restaurants", {"name": "Nope", "cuisineType": "Otra"}, format="json",
                        **bearer(client, "CLIENT"))
    assert response.status_code == 403


def test_duplicate_restaurant_name_conflict(api, restaurant, owner):
    response = api.post("/api/restaurants", {"name": "doña marta", "cuisineType": "X"}, format="json",
                        **bearer(owner, "RESTAURANT_ADMIN"))
    assert response.status_code == 409
    assert response.json()["message"] == "Ya existe un restaurante con ese nombre."


def test_mine_requires_session(api, restaurant, owner):
    assert api.get("/api/restaurants?mine=true").status_code == 401
    mine = api.get("/api/restaurants?mine=true", **bearer(owner, "RESTAURANT_ADMIN")).json()
    assert [r["name"] for r in mine] == ["Doña Marta"]


def test_create_branch_and_response_shape(api, restaurant, owner):
    response = api.post(f"/api/restaurants/{restaurant['id']}/branches",
                        branch_body(latitude=7.1193, longitude=-73.1227), format="json",
                        **bearer(owner, "RESTAURANT_ADMIN"))
    assert response.status_code == 201, response.json()
    body = response.json()
    assert set(body) == {"id", "restaurantId", "restaurantName", "cuisineType", "name", "address", "city", "phone",
                         "latitude", "longitude", "capacity", "active", "schedules", "createdAt", "updatedAt"}
    assert body["restaurantName"] == "Doña Marta"
    assert body["latitude"] == 7.1193
    assert body["schedules"][0] == {"id": body["schedules"][0]["id"], "dayOfWeek": 1, "openTime": "12:00:00",
                                    "closeTime": "22:00:00", "isClosed": False}
    assert api.get(f"/api/restaurants/branches/{body['id']}").json()["id"] == body["id"]


def test_other_admin_cannot_edit_branch(api, restaurant):
    intruder = make_user("otro@test.co")
    response = api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(), format="json",
                        **bearer(intruder, "RESTAURANT_ADMIN"))
    assert response.status_code == 403
    assert response.json()["message"] == "No tienes permisos sobre este restaurante."


def test_schedule_validation_messages(api, restaurant, owner):
    bad = week()
    bad[4]["closeTime"] = "11:00"
    response = api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(schedules=bad), format="json",
                        **bearer(owner, "RESTAURANT_ADMIN"))
    assert response.status_code == 400
    assert response.json()["message"] == "Día 5: el cierre debe ser después de la apertura."


def test_update_branch_replaces_schedule_in_place(api, restaurant, owner):
    """Portado de BranchUpdateTest: actualizar horarios no choca con uq_schedules_branch_day."""
    auth = bearer(owner, "RESTAURANT_ADMIN")
    created = api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(), format="json", **auth).json()
    monday_id = next(s["id"] for s in created["schedules"] if s["dayOfWeek"] == 1)
    new_schedule = [{"dayOfWeek": 1, "openTime": "08:00", "closeTime": "14:00"},
                    {"dayOfWeek": 7, "isClosed": True}]
    response = api.put(f"/api/restaurants/{restaurant['id']}/branches/{created['id']}",
                       branch_body(name="Sede Cabecera", schedules=new_schedule, active=False), format="json", **auth)
    assert response.status_code == 200, response.json()
    body = response.json()
    assert [s["dayOfWeek"] for s in body["schedules"]] == [1, 7]
    assert body["schedules"][0]["id"] == monday_id  # mismo registro, actualizado
    assert body["schedules"][0]["openTime"] == "08:00:00"
    assert body["schedules"][1] == {"id": body["schedules"][1]["id"], "dayOfWeek": 7, "openTime": "00:00:00",
                                    "closeTime": "00:00:00", "isClosed": True}
    assert body["active"] is False
    assert Schedule.objects.filter(branch_id=created["id"]).count() == 2


def test_duplicate_branch_name_conflict(api, restaurant, owner):
    auth = bearer(owner, "RESTAURANT_ADMIN")
    api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(), format="json", **auth)
    response = api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(name="sede cabecera"),
                        format="json", **auth)
    assert response.status_code == 409
    assert response.json()["message"] == "Ya existe una sede con ese nombre en este restaurante."


def test_search_only_active_and_exact_city(api, restaurant, owner):
    auth = bearer(owner, "RESTAURANT_ADMIN")
    api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(), format="json", **auth)
    api.post(f"/api/restaurants/{restaurant['id']}/branches", branch_body(name="Sede Floridablanca",
             city="Floridablanca", active=False), format="json", **auth)
    found = api.get("/api/restaurants/branches?city=BUCARAMANGA&name=marta&cuisine=colomb").json()
    assert [b["name"] for b in found] == ["Sede Cabecera"]
    assert api.get("/api/restaurants/branches?city=Bucara").json() == []
    assert len(api.get(f"/api/restaurants/{restaurant['id']}/branches").json()) == 2  # incluye inactivas


def test_internal_admin_check(api, restaurant, owner):
    assert api.get(f"/internal/restaurants/{restaurant['id']}/admins/{owner}").json() == {"isAdmin": True}
    assert api.get(f"/internal/restaurants/{restaurant['id']}/admins/999").json() == {"isAdmin": False}


def test_branch_not_found(api):
    response = api.get("/api/restaurants/branches/999999")
    assert response.status_code == 404
    assert response.json()["message"] == "Sede no encontrada."


def test_models_are_unmanaged():
    for model in (Restaurant, Branch, Schedule, RestaurantAdmin):
        assert model._meta.managed is False
