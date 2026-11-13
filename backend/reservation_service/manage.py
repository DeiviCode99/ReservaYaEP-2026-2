#!/usr/bin/env python
"""Comandos de Django para reservation_service. Ej.: python manage.py runserver 0.0.0.0:8083

No ejecutes `migrate`: el esquema de la base es backend/db/schema.sql.
"""
import os
import sys
from pathlib import Path


def main():
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "common"))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
