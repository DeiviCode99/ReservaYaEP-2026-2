"""Carga db/schema.sql en la base de prueba (los modelos son managed=False)."""
import pytest


@pytest.fixture(scope="session")
def django_db_setup(django_db_setup, django_db_blocker):
    from reservaya_common.testing import load_schema
    with django_db_blocker.unblock():
        load_schema()
