"""Ajustes de pruebas: PostgreSQL local y secretos de prueba (nunca Supabase)."""
import sys
from pathlib import Path

_COMMON = str(Path(__file__).resolve().parents[2] / "common")
if _COMMON not in sys.path:
    sys.path.insert(0, _COMMON)

from reservaya_common.testing import configure_test_env  # noqa: E402

configure_test_env()

from .settings import *  # noqa: E402,F401,F403
