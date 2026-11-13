"""Pruebas puras del paquete compartido (no necesitan Django)."""
import time

import jwt
import pytest

from reservaya_common import jwt_tokens
from reservaya_common.errors import BadRequest, Conflict, NotFound, error_body
from reservaya_common.settings_base import database_from_env

SECRET = "un-secreto-de-prueba-de-al-menos-32-caracteres!!"
ISSUER = "reservaya-auth"


def test_issue_and_decode_roundtrip():
    token = jwt_tokens.issue(7, "ana@test.co", "Ana Ruiz", "CLIENT",
                             secret=SECRET, issuer=ISSUER, minutes=120)
    claims = jwt_tokens.decode(token, secret=SECRET, issuer=ISSUER)
    assert claims["sub"] == "7"
    assert claims["email"] == "ana@test.co"
    assert claims["name"] == "Ana Ruiz"
    assert claims["role"] == "CLIENT"
    assert claims["iss"] == ISSUER
    assert claims["exp"] - claims["iat"] == 120 * 60
    assert jwt.get_unverified_header(token)["alg"] == "HS256"


def test_decode_rejects_other_secret():
    token = jwt_tokens.issue(1, "a@b.co", "Ab", "CLIENT", secret="x" * 40, issuer=ISSUER, minutes=5)
    with pytest.raises(jwt.InvalidTokenError):
        jwt_tokens.decode(token, secret=SECRET, issuer=ISSUER)


def test_decode_rejects_other_issuer():
    token = jwt_tokens.issue(1, "a@b.co", "Ab", "CLIENT", secret=SECRET, issuer="otro", minutes=5)
    with pytest.raises(jwt.InvalidTokenError):
        jwt_tokens.decode(token, secret=SECRET, issuer=ISSUER)


def test_decode_rejects_expired():
    now = int(time.time())
    token = jwt.encode({"sub": "1", "iss": ISSUER, "iat": now - 600, "exp": now - 60},
                       SECRET, algorithm="HS256")
    with pytest.raises(jwt.InvalidTokenError):
        jwt_tokens.decode(token, secret=SECRET, issuer=ISSUER)


def test_decode_accepts_hs512():
    # jjwt (Spring) elegía HS384/HS512 según el largo de la clave.
    now = int(time.time())
    token = jwt.encode({"sub": "3", "email": "x@y.co", "name": "Xy", "role": "RESTAURANT_ADMIN",
                        "iss": ISSUER, "iat": now, "exp": now + 60}, SECRET * 2, algorithm="HS512")
    assert jwt_tokens.decode(token, secret=SECRET * 2, issuer=ISSUER)["role"] == "RESTAURANT_ADMIN"


def test_error_body_shape():
    body = error_body(409, "No hay cupo suficiente. Disponible: 2 personas.")
    assert list(body) == ["status", "error", "message", "timestamp"]
    assert body["status"] == 409
    assert body["error"] == "Conflict"
    assert body["message"] == "No hay cupo suficiente. Disponible: 2 personas."
    assert body["timestamp"].endswith("-05:00")


def test_error_body_422_reason():
    assert error_body(422, "x")["error"] == "Unprocessable Content"


def test_api_errors_carry_status():
    assert BadRequest("x").status == 400
    assert NotFound("x").status == 404
    assert Conflict("x").status == 409
    assert str(Conflict("Duplicado")) == "Duplicado"


def test_database_from_env_jdbc(monkeypatch):
    monkeypatch.setenv("SUPABASE_DB_URL",
                       "jdbc:postgresql://aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require")
    monkeypatch.setenv("SUPABASE_DB_USER", "postgres.ref")
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "s3cr3t")
    db = database_from_env()
    assert db["ENGINE"] == "django.db.backends.postgresql"
    assert db["HOST"] == "aws-0-us-west-2.pooler.supabase.com"
    assert db["PORT"] == "5432"
    assert db["NAME"] == "postgres"
    assert db["USER"] == "postgres.ref"
    assert db["PASSWORD"] == "s3cr3t"
    assert db["OPTIONS"]["sslmode"] == "require"
    assert db["CONN_MAX_AGE"] == 60


def test_database_from_env_plain_url_with_credentials(monkeypatch):
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://u:p%40ss@localhost:5433/reservaya")
    monkeypatch.delenv("SUPABASE_DB_USER", raising=False)
    monkeypatch.delenv("SUPABASE_DB_PASSWORD", raising=False)
    db = database_from_env()
    assert (db["HOST"], db["PORT"], db["NAME"], db["USER"], db["PASSWORD"]) == (
        "localhost", "5433", "reservaya", "u", "p@ss")
    assert "sslmode" not in db["OPTIONS"]


def test_principal_from_claims():
    from reservaya_common.principal import AuthenticatedUser
    user = AuthenticatedUser.from_claims({"sub": "12", "email": "a@b.co", "name": "Ab", "role": "RESTAURANT_ADMIN"})
    assert (user.id, user.role, user.is_authenticated, user.is_admin_role) == (12, "RESTAURANT_ADMIN", True, True)


def test_get_json_unreachable_raises_unavailable():
    from reservaya_common.errors import Unavailable
    from reservaya_common.http import get_json
    with pytest.raises(Unavailable):
        get_json("http://127.0.0.1:9/nada", timeout=1)


def test_get_json_returns_status_and_body():
    import json
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from reservaya_common.http import get_json

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            code = 404 if "missing" in self.path else 200
            body = json.dumps({"path": self.path, "auth": self.headers.get("Authorization")}).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        assert get_json(base + "/ok?x=1", headers={"Authorization": "Bearer t"}) == (
            200, {"path": "/ok?x=1", "auth": "Bearer t"})
        assert get_json(base + "/missing")[0] == 404
    finally:
        server.shutdown()
