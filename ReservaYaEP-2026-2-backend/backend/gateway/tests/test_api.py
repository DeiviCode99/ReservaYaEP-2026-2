"""Pruebas del gateway con Django (sin base de datos)."""
from unittest import mock

from django.test import Client

from reservaya_common.errors import BadGateway


def test_forwards_to_service_and_returns_its_answer():
    with mock.patch("proxy.views.forward", return_value=(201, {"Content-Type": "application/json"}, b'{"id":1}')) \
            as forward:
        response = Client().post("/api/reservations?x=1", data=b'{"a":1}', content_type="application/json",
                                 HTTP_AUTHORIZATION="Bearer t")
    assert response.status_code == 201
    assert response.content == b'{"id":1}'
    method, url, headers, body = forward.call_args.args
    assert (method, url, body) == ("POST", "http://reservation.test/api/reservations?x=1", b'{"a":1}')
    assert headers["Authorization"] == "Bearer t"


def test_internal_routes_are_not_exposed():
    response = Client().get("/api/../internal/users?ids=1")
    assert response.status_code == 404
    assert Client().get("/internal/users?ids=1").status_code == 404


def test_service_down_is_502_json():
    with mock.patch("proxy.views.forward", side_effect=BadGateway("El servicio no está disponible en este momento.")):
        response = Client().get("/api/auth/config")
    assert response.status_code == 502
    assert response.json()["message"] == "El servicio no está disponible en este momento."


def test_cors_for_frontend_origin():
    response = Client().options("/api/auth/login", HTTP_ORIGIN="http://localhost:3000",
                                HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST")
    assert response["Access-Control-Allow-Origin"] == "http://localhost:3000"
    other = Client().options("/api/auth/login", HTTP_ORIGIN="http://malo.com",
                             HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST")
    assert "Access-Control-Allow-Origin" not in other
