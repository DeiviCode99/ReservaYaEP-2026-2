"""Pruebas HTTP de auth_service contra PostgreSQL local (requieren Django)."""
import time
from unittest import mock

import bcrypt
import pytest
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tokens import create_reset
from reservaya_common import jwt_tokens
from reservaya_common.testing import TEST_JWT_SECRET, bearer

pytestmark = pytest.mark.django_db


@pytest.fixture
def api():
    return APIClient()


def make_user(email="ana@test.co", password="vieja-clave", role="CLIENT", name="Ana Gómez", spring=False):
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(4)).decode()
    if spring:
        hashed = hashed.replace("$2b$", "$2a$", 1)  # formato de BCryptPasswordEncoder de Spring
    return User.objects.create(name=name, email=email, password_hash=hashed, role=role)


def test_register_returns_session(api):
    response = api.post("/api/auth/register", {"name": "Leo Díaz", "email": " LEO@Test.co ",
                                               "password": "clave-segura", "role": "restaurant_admin"},
                        format="json")
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"token", "user"}
    assert set(body["user"]) == {"id", "name", "email", "role", "createdAt"}
    assert body["user"]["email"] == "leo@test.co"
    assert body["user"]["role"] == "RESTAURANT_ADMIN"
    claims = jwt_tokens.decode(body["token"], secret=TEST_JWT_SECRET, issuer="reservaya-auth")
    assert claims["sub"] == str(body["user"]["id"])
    assert claims["role"] == "RESTAURANT_ADMIN"
    assert User.objects.get(email="leo@test.co").password_hash.startswith("$2b$10$")


def test_register_duplicate_email_conflict(api):
    make_user()
    response = api.post("/api/auth/register", {"name": "Ana", "email": "ana@test.co", "password": "12345678"},
                        format="json")
    assert response.status_code == 409
    assert response.json()["message"] == "Ya existe una cuenta con el correo: ana@test.co"


def test_register_rejects_system_admin_and_bad_input(api):
    response = api.post("/api/auth/register", {"name": "Mala", "email": "mala@test.co", "password": "12345678",
                                               "role": "system_admin"}, format="json")
    assert response.status_code == 400
    assert response.json()["message"] == "Tipo de cuenta no válido."
    response = api.post("/api/auth/register", {"name": "M", "email": "mala@test", "password": "123"}, format="json")
    assert response.status_code == 400
    body = response.json()
    assert list(body) == ["status", "error", "message", "timestamp"]
    for field in ("name:", "email:", "password:"):
        assert field in body["message"]


def test_login_with_spring_hash(api):
    make_user(spring=True)
    response = api.post("/api/auth/login", {"email": "ANA@test.co", "password": "vieja-clave"}, format="json")
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "ana@test.co"


def test_login_wrong_password(api):
    make_user()
    response = api.post("/api/auth/login", {"email": "ana@test.co", "password": "otra"}, format="json")
    assert response.status_code == 401
    assert response.json()["message"] == "Correo o contraseña incorrectos."


def test_me_requires_valid_token(api):
    user = make_user()
    assert api.get("/api/auth/me").status_code == 401
    assert api.get("/api/auth/me", HTTP_AUTHORIZATION="Bearer basura").status_code == 401
    response = api.get("/api/auth/me", **bearer(user.id, "CLIENT"))
    assert response.status_code == 200
    assert response.json()["email"] == "ana@test.co"


def test_config_is_public(api):
    assert api.get("/api/auth/config").json() == {"googleClientId": "cliente-de-prueba.apps.googleusercontent.com"}


def test_internal_users_only_for_admins(api):
    ana = make_user()
    assert api.get(f"/internal/users?ids={ana.id}", **bearer(1, "CLIENT")).status_code == 403
    response = api.get(f"/internal/users?ids={ana.id},999", **bearer(1, "RESTAURANT_ADMIN"))
    assert response.status_code == 200
    assert response.json() == [{"id": ana.id, "name": "Ana Gómez", "email": "ana@test.co"}]


def test_forgot_password_same_answer_and_mails_only_existing(api):
    ana = make_user()
    with mock.patch("accounts.mailer.send_reset") as send:
        first = api.post("/api/auth/forgot-password", {"email": "ANA@test.co"}, format="json")
        second = api.post("/api/auth/forgot-password", {"email": "nadie@test.co"}, format="json")
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    send.assert_called_once()
    assert send.call_args.args[0].id == ana.id


def test_reset_link_points_to_react_route():
    from accounts.mailer import reset_link
    assert reset_link("3.1.x") == "http://localhost:3000/recuperar?token=3.1.x"


def test_reset_password_works_only_once(api):
    ana = make_user()
    token = create_reset(ana.id, ana.password_hash, secret=TEST_JWT_SECRET, ttl_seconds=1800, now=int(time.time()))
    response = api.post("/api/auth/reset-password", {"token": token, "password": "nueva-clave-123"}, format="json")
    assert response.status_code == 200
    assert "token" in response.json()
    assert api.post("/api/auth/login", {"email": "ana@test.co", "password": "nueva-clave-123"},
                    format="json").status_code == 200
    again = api.post("/api/auth/reset-password", {"token": token, "password": "otra-clave-456"}, format="json")
    assert again.status_code == 400
    assert again.json()["message"] == "El enlace no es válido o ya venció. Solicita uno nuevo."


def test_google_links_existing_or_creates_with_role(api):
    from accounts.rules import GoogleUser
    make_user()
    with mock.patch("accounts.google.verify", return_value=GoogleUser("ana@test.co", "Ana G")):
        response = api.post("/api/auth/google", {"credential": "tok", "role": "RESTAURANT_ADMIN"}, format="json")
    assert response.json()["user"]["role"] == "CLIENT"  # cuenta existente: no cambia su rol
    with mock.patch("accounts.google.verify", return_value=GoogleUser("leo@test.co", "Leo")):
        response = api.post("/api/auth/google", {"credential": "tok", "role": "RESTAURANT_ADMIN"}, format="json")
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "RESTAURANT_ADMIN"
    assert response.json()["user"]["email"] == "leo@test.co"
