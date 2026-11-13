"""Errores de negocio con su código HTTP y el cuerpo JSON de error.

El cuerpo es el mismo que devolvía el backend Spring, que es lo que lee el
frontend (`data.message`): {status, error, message, timestamp}.
No importa Django, así que se puede probar sin él.
"""
from datetime import datetime
from http import HTTPStatus
from zoneinfo import ZoneInfo

ZONE = ZoneInfo("America/Bogota")


class ApiError(Exception):
    status = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class BadRequest(ApiError):
    status = 400


class Unauthorized(ApiError):
    status = 401


class Forbidden(ApiError):
    status = 403


class NotFound(ApiError):
    status = 404


class Conflict(ApiError):
    status = 409


class Unprocessable(ApiError):
    status = 422


class BadGateway(ApiError):
    status = 502


class Unavailable(ApiError):
    status = 503


def reason_phrase(status: int) -> str:
    if status == 422:
        return "Unprocessable Content"  # nombre actual (RFC 9110), igual que Spring
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def error_body(status: int, message: str) -> dict:
    return {
        "status": status,
        "error": reason_phrase(status),
        "message": message,
        "timestamp": datetime.now(ZONE).isoformat(),
    }
