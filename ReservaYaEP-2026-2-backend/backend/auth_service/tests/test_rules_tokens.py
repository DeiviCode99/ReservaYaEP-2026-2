"""Reglas puras de auth_service: tokens de recuperación y rol permitido."""
import pytest

from accounts.rules import normalize_email, self_service_role, valid_email
from accounts.tokens import create_reset, reset_matches, reset_user_id
from reservaya_common.errors import BadRequest

SECRET = "una-clave-de-pruebas-de-al-menos-32-bytes!!"
HASH = "$2a$10$abcdefghijklmnopqrstuuJ0b3x8n6sVt1cN2Qh5yK2s9zXh0yW6e"
NOW = 1_800_000_000


def test_reset_token_roundtrip():
    token = create_reset(3, HASH, secret=SECRET, ttl_seconds=1800, now=NOW)
    assert token.startswith(f"3.{NOW + 1800}.")
    assert "=" not in token
    assert reset_user_id(token) == 3
    assert reset_matches(token, 3, HASH, secret=SECRET, now=NOW + 60)


def test_reset_token_expires():
    token = create_reset(3, HASH, secret=SECRET, ttl_seconds=1800, now=NOW)
    assert not reset_matches(token, 3, HASH, secret=SECRET, now=NOW + 1801)


def test_reset_token_single_use():
    token = create_reset(3, HASH, secret=SECRET, ttl_seconds=1800, now=NOW)
    assert not reset_matches(token, 3, HASH + "x", secret=SECRET, now=NOW)  # la contraseña ya cambió


def test_reset_token_tampered_or_foreign():
    token = create_reset(3, HASH, secret=SECRET, ttl_seconds=1800, now=NOW)
    uid, exp, sig = token.split(".")
    assert not reset_matches(f"{uid}.{int(exp) + 3600}.{sig}", 3, HASH, secret=SECRET, now=NOW)
    assert not reset_matches(f"99.{exp}.{sig}", 99, HASH, secret=SECRET, now=NOW)
    assert not reset_matches("basura", 3, HASH, secret=SECRET, now=NOW)
    assert not reset_matches(token, 3, HASH, secret="otra-clave-de-al-menos-32-caracteres!!", now=NOW)
    assert reset_user_id("basura") is None
    assert reset_user_id("x.1.y") is None


def test_reset_signature_matches_spring_format():
    # HMAC-SHA256("password-reset:"+secret, "id|exp|hash") en base64url sin relleno.
    import base64
    import hashlib
    import hmac
    token = create_reset(3, HASH, secret=SECRET, ttl_seconds=1800, now=NOW)
    mac = hmac.new(("password-reset:" + SECRET).encode(), f"3|{NOW + 1800}|{HASH}".encode(), hashlib.sha256)
    assert token.split(".")[2] == base64.urlsafe_b64encode(mac.digest()).decode().rstrip("=")


def test_self_service_role():
    assert self_service_role(None) == "CLIENT"
    assert self_service_role("  ") == "CLIENT"
    assert self_service_role("restaurant_admin") == "RESTAURANT_ADMIN"
    assert self_service_role(" Client ") == "CLIENT"
    for bad in ("SYSTEM_ADMIN", "system_admin", "hacker"):
        with pytest.raises(BadRequest, match="Tipo de cuenta no válido."):
            self_service_role(bad)


def test_email_rules():
    assert normalize_email("  ANA@Test.co ") == "ana@test.co"
    assert valid_email("ana@test.co")
    assert not valid_email("ana@test.c")
    assert not valid_email("ana test@x.co")
    assert not valid_email("sin-arroba.co")


def test_google_profile_name_fallback():
    from accounts.rules import user_from_claims
    assert user_from_claims({"email": " Leo@Test.co ", "name": "L"}).name == "leo"
    assert user_from_claims({"email": "a@b.co", "name": "x" * 100}).name == "x" * 80
    assert user_from_claims({"email": "A@B.co", "name": "Ana"}).email == "a@b.co"
