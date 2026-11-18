"""Casos de uso del catálogo: marcas (RF-03, RF-13), sedes y horarios, búsqueda (RF-04)."""
import functools
from decimal import Decimal

from django.db import IntegrityError, transaction

from reservaya_common.errors import Conflict, Forbidden, NotFound
from reservaya_common.principal import AuthenticatedUser

from .domain import constraint_message, plan_schedule_changes, schedule_values, validate_schedules
from .models import Branch, Restaurant, RestaurantAdmin, Schedule
from .representations import branch_dict, restaurant_dict

RESTAURANT_ROLES = ("RESTAURANT_ADMIN", "SYSTEM_ADMIN")


def translate_integrity_errors(func):
    """Restricciones de la BD (nombres únicos, aforo, horarios) → 409 con un mensaje claro."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except IntegrityError as error:
            raise Conflict(constraint_message(str(error))) from error
    return wrapper


def _branches():
    return Branch.objects.select_related("restaurant").prefetch_related("schedules")


# ----------------------------------------------------------------- consultas

def search_restaurants(name: str, city: str, cuisine: str) -> list[dict]:
    query = Restaurant.objects.all()
    if name:
        query = query.filter(name__icontains=name)
    if cuisine:
        query = query.filter(cuisine_type__icontains=cuisine)
    if city:
        query = query.filter(branches__city__iexact=city).distinct()
    return [restaurant_dict(r) for r in query.order_by("name")]


def my_restaurants(user: AuthenticatedUser) -> list[dict]:
    ids = RestaurantAdmin.objects.filter(user_id=user.id).values_list("restaurant_id", flat=True)
    return [restaurant_dict(r) for r in Restaurant.objects.filter(id__in=list(ids)).order_by("name")]


def search_branches(name: str, city: str, cuisine: str) -> list[dict]:
    """Búsqueda del cliente: solo sedes activas, con su marca."""
    query = _branches().filter(active=True)
    if name:
        query = query.filter(restaurant__name__icontains=name)
    if city:
        query = query.filter(city__iexact=city)
    if cuisine:
        query = query.filter(restaurant__cuisine_type__icontains=cuisine)
    return [branch_dict(b) for b in query.order_by("restaurant__name", "name")]


def branches_of(restaurant_id: int) -> list[dict]:
    return [branch_dict(b) for b in _branches().filter(restaurant_id=restaurant_id).order_by("id")]


def branch_detail(branch_id: int) -> dict:
    branch = _branches().filter(id=branch_id).first()
    if branch is None:
        raise NotFound("Sede no encontrada.")
    return branch_dict(branch)


def is_admin(user_id: int, restaurant_id: int) -> bool:
    return RestaurantAdmin.objects.filter(user_id=user_id, restaurant_id=restaurant_id).exists()


def verify_admin(user: AuthenticatedUser, restaurant_id: int) -> None:
    if user.role == "SYSTEM_ADMIN":
        return
    if not is_admin(user.id, restaurant_id):
        raise Forbidden("No tienes permisos sobre este restaurante.")


# ------------------------------------------------------------------- marcas

@translate_integrity_errors
@transaction.atomic
def create_restaurant(data: dict, user: AuthenticatedUser) -> dict:
    if user.role not in RESTAURANT_ROLES:
        raise Forbidden("Solo una cuenta de restaurante puede registrar restaurantes.")
    name = data["name"].strip()
    if Restaurant.objects.filter(name__iexact=name).exists():
        raise Conflict("Ya existe un restaurante con ese nombre.")
    restaurant = Restaurant(name=name, cuisine_type=data["cuisineType"].strip(),
                            description=data.get("description"), logo_url=data.get("logoUrl"))
    restaurant.save()
    RestaurantAdmin.objects.create(user_id=user.id, restaurant=restaurant)
    return restaurant_dict(restaurant)


@translate_integrity_errors
@transaction.atomic
def update_restaurant(restaurant_id: int, data: dict, user: AuthenticatedUser) -> dict:
    restaurant = Restaurant.objects.filter(id=restaurant_id).first()
    if restaurant is None:
        raise NotFound("Restaurante no encontrado.")
    verify_admin(user, restaurant.id)
    name = data["name"].strip()
    if Restaurant.objects.filter(name__iexact=name).exclude(id=restaurant_id).exists():
        raise Conflict("Ya existe un restaurante con ese nombre.")
    restaurant.name = name
    restaurant.cuisine_type = data["cuisineType"].strip()
    restaurant.description = data.get("description")
    restaurant.logo_url = data.get("logoUrl")
    restaurant.save()
    return restaurant_dict(restaurant)


# -------------------------------------------------------------------- sedes

def _coordinate(value):
    return None if value is None else Decimal(str(round(value, 6)))


def _apply_branch_fields(branch: Branch, data: dict) -> None:
    branch.name = data["name"].strip()
    branch.address = data["address"].strip()
    branch.city = data["city"].strip()
    branch.phone = data.get("phone")
    branch.latitude = _coordinate(data.get("latitude"))
    branch.longitude = _coordinate(data.get("longitude"))
    branch.capacity = data["capacity"]
    if data.get("active") is not None:
        branch.active = data["active"]


@translate_integrity_errors
@transaction.atomic
def create_branch(restaurant_id: int, data: dict, user: AuthenticatedUser) -> dict:
    restaurant = Restaurant.objects.filter(id=restaurant_id).first()
    if restaurant is None:
        raise NotFound("Restaurante no encontrado.")
    verify_admin(user, restaurant_id)
    if Branch.objects.filter(restaurant_id=restaurant_id, name__iexact=data["name"].strip()).exists():
        raise Conflict("Ya existe una sede con ese nombre en este restaurante.")
    schedules = data.get("schedules")
    validate_schedules(schedules)

    branch = Branch(restaurant=restaurant)
    _apply_branch_fields(branch, data)
    branch.save()
    for item in schedules or []:
        Schedule.objects.create(branch=branch, day_of_week=item["dayOfWeek"], **schedule_values(item))
    return branch_detail(branch.id)


@translate_integrity_errors
@transaction.atomic
def update_branch(restaurant_id: int, branch_id: int, data: dict, user: AuthenticatedUser) -> dict:
    verify_admin(user, restaurant_id)
    branch = Branch.objects.filter(id=branch_id, restaurant_id=restaurant_id).first()
    if branch is None:
        raise NotFound("Sede no encontrada.")
    if (Branch.objects.filter(restaurant_id=restaurant_id, name__iexact=data["name"].strip())
            .exclude(id=branch_id).exists()):
        raise Conflict("Ya existe una sede con ese nombre en este restaurante.")
    schedules = data.get("schedules")
    validate_schedules(schedules)

    _apply_branch_fields(branch, data)
    branch.save()
    if schedules is not None:
        _replace_schedules(branch, schedules)
    return branch_detail(branch.id)


def _replace_schedules(branch: Branch, requested: list[dict]) -> None:
    current = {s.day_of_week: s for s in branch.schedules.all()}
    to_update, to_create, to_delete = plan_schedule_changes(set(current), requested)
    # Primero se borran los días que ya no vienen, luego se actualiza y se crea.
    Schedule.objects.filter(branch=branch, day_of_week__in=to_delete).delete()
    for item in to_update:
        schedule = current[item["dayOfWeek"]]
        for field, value in schedule_values(item).items():
            setattr(schedule, field, value)
        schedule.save()
    for item in to_create:
        Schedule.objects.create(branch=branch, day_of_week=item["dayOfWeek"], **schedule_values(item))
