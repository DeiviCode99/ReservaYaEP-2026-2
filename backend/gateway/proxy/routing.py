"""Enrutamiento del gateway (RNF-05), sin dependencias de Django.

/api/auth/**          → auth_service
/api/restaurants/**   → restaurant_service
/api/reservations/**  → reservation_service
Todo lo demás (incluido /internal/**) no se expone.
"""
import logging
import re
import urllib.error
import urllib.request

from reservaya_common.errors import BadGateway

log = logging.getLogger(__name__)
_PATH = re.compile(r"^/api/(auth|restaurants|reservations)(/[A-Za-z0-9_\-/]*)?$")
FORWARDED_REQUEST_HEADERS = ("Authorization", "Content-Type", "Accept", "Accept-Language")
FORWARDED_RESPONSE_HEADERS = ("Content-Type", "WWW-Authenticate")


def target_url(path: str, query: str, routes: dict[str, str]) -> str | None:
    """URL del servicio destino, o None si la ruta no se expone."""
    match = _PATH.match(path)
    if not match or ".." in path:
        return None
    base = routes[match.group(1)].rstrip("/")
    return base + path + (f"?{query}" if query else "")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def forward(method: str, url: str, headers: dict, body: bytes | None, timeout: float = 15):
    """Reenvía la petición y devuelve (código, cabeceras, cuerpo) tal cual.

    Si el servicio no responde lanza BadGateway (502).
    """
    request = urllib.request.Request(url, data=body if body else None, method=method,
                                     headers={k: v for k, v in headers.items() if v})
    try:
        with _opener.open(request, timeout=timeout) as response:
            return response.status, _pick(response.headers), response.read()
    except urllib.error.HTTPError as error:  # 4xx/5xx del servicio: se devuelven igual
        return error.code, _pick(error.headers), error.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
        log.warning("Servicio sin respuesta en %s: %s", url, error)
        raise BadGateway("El servicio no está disponible en este momento. Intenta de nuevo.") from error


def _pick(headers) -> dict:
    return {name: headers[name] for name in FORWARDED_RESPONSE_HEADERS if headers and headers.get(name)}
