"""Llamadas HTTP a los otros servicios.

- restaurant_service: datos de la sede (aforo, horarios, marca) y si un usuario
  administra la marca.
- auth_service: nombre y correo de los clientes para el panel del restaurante.
"""
import logging
from urllib.parse import quote

from django.conf import settings

from reservaya_common.errors import ApiError, NotFound, Unavailable
from reservaya_common.http import get_json

log = logging.getLogger(__name__)


def get_branch(branch_id: int) -> dict:
    status, body = get_json(f"{settings.RESTAURANT_SERVICE_URI}/api/restaurants/branches/{int(branch_id)}")
    if status == 404:
        raise NotFound(f"Sede no encontrada (id={branch_id}).")
    if status != 200 or not isinstance(body, dict):
        raise Unavailable("No se pudo consultar la sede. Intenta de nuevo en un momento.")
    return body


def is_admin_of(user_id: int, restaurant_id: int) -> bool:
    status, body = get_json(f"{settings.RESTAURANT_SERVICE_URI}/internal/restaurants/"
                            f"{int(restaurant_id)}/admins/{int(user_id)}")
    if status != 200 or not isinstance(body, dict):
        raise Unavailable("No se pudo verificar el administrador de la sede.")
    return body.get("isAdmin") is True


def users_by_ids(ids, authorization: str) -> dict[int, dict]:
    """{id: {id, name, email}}. Si auth_service falla, la lista se muestra sin esos datos."""
    if not ids:
        return {}
    query = quote(",".join(str(i) for i in sorted(ids)), safe=",")
    try:
        status, body = get_json(f"{settings.AUTH_SERVICE_URI}/internal/users?ids={query}",
                                headers={"Authorization": authorization or ""})
    except ApiError as error:
        log.warning("No se pudieron obtener los datos de los clientes: %s", error)
        return {}
    if status != 200 or not isinstance(body, list):
        log.warning("auth_service respondió %s al pedir datos de clientes", status)
        return {}
    return {int(user["id"]): user for user in body if isinstance(user, dict) and "id" in user}
