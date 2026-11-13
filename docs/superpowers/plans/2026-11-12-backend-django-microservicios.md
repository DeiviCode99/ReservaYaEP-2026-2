# Backend Django con microservicios + frontend React — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el backend Spring por 3 microservicios Django + gateway Django con el mismo contrato HTTP, y dejar `frontend/` = el React del equipo.

**Architecture:** Cada servicio es un proyecto Django + DRF independiente sobre la misma BD de Supabase (modelos `managed=False`). Las reglas de negocio puras (sin importar Django) viven en `domain.py`/`tokens.py` y se prueban con pytest simple; las vistas DRF solo traducen HTTP ↔ servicios. Un paquete `reservaya_common` comparte JWT, errores y cliente HTTP.

**Tech Stack:** Python 3.12, Django 5.2, DRF 3.16, psycopg 3, PyJWT, bcrypt, django-cors-headers, gunicorn, pytest, pytest-django; React 18 + Vite (sin cambios de pila).

**Spec:** `docs/superpowers/specs/2026-11-12-backend-django-microservicios-design.md`

## Global Constraints

- Contrato HTTP idéntico al de Spring (rutas, métodos, camelCase, códigos, error `{status, error, message, timestamp}`); horas `HH:MM:SS`, fechas `YYYY-MM-DD`.
- Modelos `managed=False`; nunca `migrate` contra Supabase. `db/schema.sql` y `db/migrations/` sin cambios.
- Zona `America/Bogota`; `MIN_HOURS_BEFORE_CANCEL=2`; reset 30 min; JWT 120 min, `iss=reservaya-auth`, HS256.
- Sin `django.contrib.auth/admin/sessions/contenttypes`.
- Pruebas automáticas nunca contra Supabase.
- Puertos: gateway 8080, auth 8081, restaurant 8082, reservation 8083, frontend 3000.

## Review Focus

1. Usuario creado por Spring (`$2a$10$…`) inicia sesión → debe entrar (prueba en Task 3).
2. Token vencido o con firma de otro secreto en ruta protegida → 401 JSON, no 500 (Task 2).
3. Franjas cuyo cierre es 23:30 o 00:00 → el ciclo termina y no repite franjas (Task 5, `hourly_slots`).
4. Modificar la reserva a la misma franja con el cupo justo → se permite contando sus propios puestos (Task 5).
5. Restaurant-service caído al crear reserva → 503 JSON, no 500 (Task 5).

---

### Task 1: Limpieza del repositorio

**Files:** `.gitattributes` (crear); borrar `backend/api-gateway`, `backend/*-service`, `backend/Dockerfile`, `backend/run-dev.ps1` (se reescriben en Task 7).

- [ ] Descartar cambios de solo fin de línea: `git diff --ignore-cr-at-eol --quiet && git checkout -- .`
- [ ] Crear `.gitattributes` (`* text=auto eol=lf`, `*.ps1 text eol=crlf`, binarios `-text`).
- [ ] `git rm -r` del backend Java; commit `chore: retirar backend Spring Boot`.

### Task 2: Paquete compartido `backend/common/reservaya_common`

**Files:** `errors.py`, `jwt_tokens.py`, `auth.py`, `http.py`, `settings_base.py`, `responses.py`; tests en `backend/common/tests/`.

**Interfaces (Produces):**
- `errors.ApiError(message: str)` con `status: int`; subclases `BadRequest(400)`, `Unauthorized(401)`, `Forbidden(403)`, `NotFound(404)`, `Conflict(409)`, `Unprocessable(422)`, `Unavailable(503)`, `BadGateway(502)`.
- `errors.error_body(status: int, message: str) -> dict` → `{status, error (reason phrase), message, timestamp}`.
- `errors.drf_exception_handler(exc, context) -> Response` (validación → 400 `campo: msg; …`; `NotAuthenticated/AuthenticationFailed` → 401; otro → 500 "Error interno del servidor.").
- `jwt_tokens.issue(user_id: int, email: str, name: str, role: str, *, secret: str, issuer: str, minutes: int) -> str`
- `jwt_tokens.decode(token: str, *, secret: str, issuer: str) -> dict` (acepta HS256/384/512; lanza `jwt.InvalidTokenError`).
- `auth.AuthenticatedUser(id: int, email: str, name: str, role: str)` (dataclass, `is_authenticated = True`).
- `auth.JWTAuthentication` (DRF; `authenticate_header` → `'Bearer'`, así DRF responde 401).
- `http.get_json(url: str, *, headers: dict | None = None, timeout: float = 5) -> tuple[int, object]`; error de red → `Unavailable`.
- `settings_base.database_from_env() -> dict` (acepta `jdbc:postgresql://…`); `settings_base.base_settings(service_name: str, *, with_db: bool) -> dict`.

- [ ] Tests puros: `test_issue_and_decode_roundtrip`, `test_decode_rejects_other_secret`, `test_decode_rejects_other_issuer`, `test_decode_accepts_hs512`, `test_error_body_shape`, `test_database_from_env_jdbc` (`jdbc:postgresql://h:5432/postgres?sslmode=require` → HOST `h`, PORT `5432`, NAME `postgres`, `sslmode=require`).
- [ ] Implementar; `pytest backend/common` PASS; commit.

### Task 3: `auth_service`

**Files:** `backend/auth_service/{manage.py, config/settings.py, config/urls.py, accounts/{models.py, tokens.py, google.py, mailer.py, services.py, serializers.py, views.py, urls.py}, tests/}`

**Interfaces:**
- Consumes: Task 2.
- Produces: `POST /api/auth/{register,login,google,forgot-password,reset-password}`, `GET /api/auth/{me,config}`, `GET /internal/users?ids=1,2` → `[{id,name,email}]`.
- `tokens.create_reset(user_id: int, password_hash: str, *, secret: str, ttl_seconds: int, now: int) -> str`; `tokens.reset_user_id(token: str) -> int | None`; `tokens.reset_matches(token: str, user_id: int, password_hash: str, *, secret: str, now: int) -> bool` (HMAC-SHA256, clave `"password-reset:"+secret`, mensaje `f"{id}|{exp}|{hash}"`, base64url sin `=`).
- `services.self_service_role(role: str | None) -> str`.

- [ ] Tests puros: `test_reset_token_roundtrip`, `test_reset_token_expires`, `test_reset_token_single_use` (cambiar hash → no coincide), `test_reset_token_tampered`, `test_self_service_role` (`None→CLIENT`, `"restaurant_admin"→RESTAURANT_ADMIN`, `"SYSTEM_ADMIN"→BadRequest "Tipo de cuenta no válido."`).
- [ ] Tests Django (`@pytest.mark.django_db`): registro 201 con `{token,user}`; correo repetido 409; login con hash `$2a$10$` (generado con bcrypt y prefijo cambiado) → 200; contraseña mala 401; `/me` sin token 401; `/internal/users` con token CLIENT 403; forgot-password misma respuesta exista o no.
- [ ] Implementar; commit.

### Task 4: `restaurant_service`

**Files:** `backend/restaurant_service/{manage.py, config/*, catalog/{models.py, domain.py, services.py, serializers.py, views.py, urls.py}, tests/}`

**Interfaces:**
- Produces: rutas de §5.5 + `GET /internal/restaurants/{id}/admins/{userId}` → `{isAdmin: bool}`; `GET /api/restaurants/branches/{id}` → `BranchResponse` (con `restaurantName`, `schedules`).
- `domain.validate_schedules(schedules: list[dict]) -> None` (mensajes exactos: "El día N aparece repetido en el horario.", "Completa la hora de apertura y cierre del día N.", "Día N: el cierre debe ser después de la apertura.").
- `domain.constraint_message(detail: str) -> str` (mapa de Spring + `schedules_day_of_week_check`).

- [ ] Tests puros de `validate_schedules` y `constraint_message`.
- [ ] Tests Django: búsqueda solo activas y ciudad exacta; crear marca vincula admin; nombre duplicado 409; editar sede de otro admin 403; actualizar horario en su sitio (portar `BranchUpdateTest`); `?mine=true` sin token 403.
- [ ] Implementar; commit.

### Task 5: `reservation_service`

**Files:** `backend/reservation_service/{manage.py, config/*, bookings/{models.py, domain.py, clients.py, availability.py, services.py, notifier.py, serializers.py, views.py, urls.py}, tests/}`, `backend/db/cleanup_qa.sql`.

**Interfaces:**
- Consumes: `GET {RESTAURANT_SERVICE_URI}/api/restaurants/branches/{id}`, `GET …/internal/restaurants/{rid}/admins/{uid}`, `GET {AUTH_SERVICE_URI}/internal/users?ids=`.
- `domain.ACTIVE = ("PENDING", "CONFIRMED")`
- `domain.can_restaurant_change(prev: str, nxt: str) -> bool`
- `domain.initials(value: str | None) -> str`; `domain.confirmation_code(customer: str, restaurant: str, number: int) -> str`
- `domain.hourly_slots(open_t: time, close_t: time, *, day: date, today: date, now_t: time) -> list[time]`
- `domain.whole_hours_between(start: datetime, end: datetime) -> int` (trunca hacia cero, como `ChronoUnit.HOURS`).
- `availability.occupied_seats(branch_id, day, slot) -> int` (SQL con `SUM` sobre `ACTIVE`); `availability.lock_slot(branch_id, day, slot)` → `SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))` con clave `f"{branch}|{day}|{slot}"`.

- [ ] Tests puros: `initials("Juan Rangel")=="JR"`, `initials("Ánfora")=="ANF"`, `initials("")=="RY"`, código `"DZ-DM-123456"` para (`"David Zapata"`, `"Doña Marta"`, 123456); transiciones (todas las 25 combinaciones); `hourly_slots(12:00, 15:00)` → 12,13,14; `hourly_slots(22:00, 23:30)` → 22,23; `hourly_slots(23:00, 00:00?)` cierre ≤ apertura → `[]`; hoy a las 13:10 con 12–15 → solo 14; `whole_hours_between` 1h59m → 1.
- [ ] SQL: aplicar `schema.sql`+V2–V4 en PostgreSQL 16 local y probar la consulta de cupo y el bloqueo consultivo.
- [ ] Tests Django (cliente HTTP simulado): crear reserva PENDING con código y auditoría; sin cupo 409; franja inexistente 422; modificar misma franja con cupo justo OK; cancelar con < 2 h → 422; reserva ajena → 422; admin ajeno → 403; transición inválida → 422; restaurant caído → 503 (portar `ReservationFlowTest`, `BranchReservationFlowTest`).
- [ ] Implementar; commit.

### Task 6: `gateway`

**Files:** `backend/gateway/{manage.py, config/{settings.py, urls.py}, proxy/views.py, tests/}`

- Rutas: `api/auth/<path>`, `api/restaurants/<path>`, `api/reservations/<path>` (incluye la raíz sin barra) → servicio; `/internal/*` 404; `GET /health`.
- [ ] Tests: reenvía método, query, cuerpo y `Authorization`; destino caído → 502 JSON; CORS para `FRONTEND_ORIGIN`.
- [ ] Implementar; commit.

### Task 7: Ejecución local y despliegue

**Files:** `backend/{requirements.txt, requirements-dev.txt, pytest.ini, conftest.py, .env.example, run-dev.ps1, run-tests.ps1, Dockerfile, docker-compose.yml, docker-compose.test.yml, caddy/Caddyfile, caddy/Dockerfile, README.md}`

- `conftest.py`: `django_db_setup` que crea la BD de prueba y ejecuta `db/schema.sql` + migraciones.
- `Caddyfile`: `/api/*` → gateway; resto `try_files {path} /index.html`; redirecciones `.html` → rutas React (incl. `/recuperar.html?token=`).
- [ ] `python -m py_compile` de todo `backend/`; commit.

### Task 8: Frontend

**Files:** mover `frontend_react/` → `frontend/` (borrando antes el vanilla); `frontend/README.md`; `frontend/vite.config.js` (proxy por servicio no necesario: gateway 8080).

- [ ] Comparar pantallas vanilla ↔ React (antes de borrar) y anotar faltantes; implementarlos.
- [ ] Commit `refactor: frontend React reemplaza al vanilla`.

### Task 9: Documentación

- [ ] README raíz, `docs/SRS-ReservaYa.md` (Spring → Django), `.gitignore` (`__pycache__`, `.venv`, `.pytest_cache`); commit.

### Task 10: Verificación y despliegue

- [ ] En el PC del equipo: `.\run-tests.ps1`, `.\run-dev.ps1 -Frontend`, recorrido manual con datos `qa+…@reservaya.test`, `cleanup_qa.sql`.
- [ ] VM: `git pull`, `docker compose down` (Spring) → `docker compose up -d --build` (Django) siguiendo `backend/README.md` §Despliegue.
