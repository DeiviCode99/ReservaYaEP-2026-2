"""Cliente HTTP mínimo para hablar entre servicios (solo biblioteca estándar)."""
import json
import logging
import urllib.error
import urllib.request

from .errors import Unavailable

log = logging.getLogger(__name__)


def get_json(url: str, *, headers: dict | None = None, timeout: float = 5) -> tuple[int, object]:
    """GET que devuelve (código, JSON). Errores 4xx/5xx se devuelven, no se lanzan.

    Si el otro servicio no responde lanza Unavailable (503).
    """
    request = urllib.request.Request(url, headers={"Accept": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, _json(response.read())
    except urllib.error.HTTPError as error:
        return error.code, _json(error.read())
    except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
        log.warning("Servicio no disponible en %s: %s", url, error)
        raise Unavailable("Un servicio interno no está disponible. Intenta de nuevo en un momento.") from error


def _json(raw: bytes):
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except ValueError:
        return None
