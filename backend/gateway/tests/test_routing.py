"""Enrutamiento y reenvío del gateway, sin Django."""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from proxy.routing import forward, target_url

ROUTES = {"auth": "http://auth:8081", "restaurants": "http://rest:8082/", "reservations": "http://resv:8083"}


def test_target_url_routes_by_prefix():
    assert target_url("/api/auth/login", "", ROUTES) == "http://auth:8081/api/auth/login"
    assert target_url("/api/restaurants", "mine=true", ROUTES) == "http://rest:8082/api/restaurants?mine=true"
    assert target_url("/api/reservations/5/status", "", ROUTES) == "http://resv:8083/api/reservations/5/status"


def test_target_url_rejects_unknown_and_internal():
    assert target_url("/internal/users", "ids=1", ROUTES) is None
    assert target_url("/api/authx/login", "", ROUTES) is None
    assert target_url("/api/other", "", ROUTES) is None
    assert target_url("/api/auth/../../internal/users", "", ROUTES) is None


@pytest.fixture
def upstream():
    seen = {}

    class Handler(BaseHTTPRequestHandler):
        def _reply(self):
            length = int(self.headers.get("Content-Length") or 0)
            seen.update(method=self.command, path=self.path, auth=self.headers.get("Authorization"),
                        body=self.rfile.read(length).decode() if length else "")
            code = 409 if "conflict" in self.path else 200
            payload = json.dumps({"ok": code == 200}).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = _reply

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}", seen
    server.shutdown()


def test_forward_passes_method_body_and_auth(upstream):
    base, seen = upstream
    status, headers, body = forward("PATCH", base + "/api/reservations/3?x=1",
                                    {"Authorization": "Bearer t", "Content-Type": "application/json"},
                                    b'{"status":"CONFIRMED"}')
    assert status == 200
    assert json.loads(body) == {"ok": True}
    assert headers["Content-Type"] == "application/json"
    assert seen == {"method": "PATCH", "path": "/api/reservations/3?x=1", "auth": "Bearer t",
                    "body": '{"status":"CONFIRMED"}'}


def test_forward_returns_error_status_as_is(upstream):
    base, _ = upstream
    status, _, body = forward("POST", base + "/conflict", {}, b"{}")
    assert status == 409
    assert json.loads(body) == {"ok": False}


def test_forward_unreachable_raises():
    from reservaya_common.errors import BadGateway
    with pytest.raises(BadGateway):
        forward("GET", "http://127.0.0.1:9/api/auth/config", {}, None, timeout=1)
