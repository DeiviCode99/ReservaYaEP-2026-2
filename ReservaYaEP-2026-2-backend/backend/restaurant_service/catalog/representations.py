"""Respuestas JSON con los mismos campos (camelCase) que el backend anterior."""
from django.utils import timezone


def _ts(value):
    return timezone.localtime(value).isoformat() if value else None


def _hhmmss(value):
    return value.strftime("%H:%M:%S") if value else None


def _num(value):
    return float(value) if value is not None else None


def restaurant_dict(r) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "cuisineType": r.cuisine_type,
        "description": r.description,
        "logoUrl": r.logo_url,
        "createdAt": _ts(r.created_at),
        "updatedAt": _ts(r.updated_at),
    }


def schedule_dict(s) -> dict:
    return {
        "id": s.id,
        "dayOfWeek": s.day_of_week,
        "openTime": _hhmmss(s.open_time),
        "closeTime": _hhmmss(s.close_time),
        "isClosed": s.is_closed,
    }


def branch_dict(b) -> dict:
    schedules = sorted(b.schedules.all(), key=lambda s: s.day_of_week)
    return {
        "id": b.id,
        "restaurantId": b.restaurant_id,
        "restaurantName": b.restaurant.name,
        "cuisineType": b.restaurant.cuisine_type,
        "name": b.name,
        "address": b.address,
        "city": b.city,
        "phone": b.phone,
        "latitude": _num(b.latitude),
        "longitude": _num(b.longitude),
        "capacity": b.capacity,
        "active": b.active,
        "schedules": [schedule_dict(s) for s in schedules],
        "createdAt": _ts(b.created_at),
        "updatedAt": _ts(b.updated_at),
    }
