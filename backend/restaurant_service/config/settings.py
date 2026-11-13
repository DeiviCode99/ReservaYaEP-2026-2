"""restaurant_service — marcas, sedes, horarios y búsqueda (RF-03, RF-04, RF-13).
Dueño de las tablas restaurants, branches, schedules y restaurant_admins."""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
_COMMON = str(BASE_DIR.parent / "common")
if _COMMON not in sys.path:
    sys.path.insert(0, _COMMON)

from reservaya_common.settings_base import base_settings, load_dotenv  # noqa: E402

load_dotenv(BASE_DIR.parent / ".env")
globals().update(base_settings("restaurant-service", with_db=True, extra_apps=["catalog"]))
