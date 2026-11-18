# ReservaYa — Backend

Backend de la plataforma de reservas de restaurantes en **Python 3.12 + Django 5.2
+ Django REST Framework**, con arquitectura de **microservicios** y PostgreSQL
sobre **Supabase**.

## Servicios

| Servicio | Puerto | Responsabilidad | Tablas | Requisitos |
|---|---|---|---|---|
| `gateway` | 8080 | Punto de entrada único, enrutamiento y CORS | — | RNF-05 |
| `auth_service` | 8081 | Registro, login, Google, recuperación de cuenta, JWT | `users` | RF-01, RF-02, RF-14, RF-15, RF-16 |
| `restaurant_service` | 8082 | Marcas, sedes, horarios, búsqueda | `restaurants`, `branches`, `schedules`, `restaurant_admins` | RF-03, RF-04, RF-13 |
| `reservation_service` | 8083 | Reservas, disponibilidad, aforo, cambios de estado | `reservations`, `reservation_audit` | RF-05 … RF-12 |

```
frontend React (3000) ──► gateway (8080) ──┬──► auth_service (8081) ─────────┐
                                           ├──► restaurant_service (8082) ───┼──► Supabase
                                           └──► reservation_service (8083) ──┘
                                                   │  aforo, horarios y dueño de la sede → restaurant_service
                                                   └─ nombre y correo de clientes        → auth_service
```

- Cada servicio es un proyecto Django independiente y solo toca **sus** tablas;
  los datos de otro servicio se piden por HTTP (rutas `/internal/...`, que el
  gateway no expone).
- `common/reservaya_common` tiene lo transversal: JWT, formato de errores,
  cliente HTTP y ajustes comunes.
- Las reglas de negocio puras viven en `domain.py` / `rules.py` / `tokens.py`
  de cada servicio (sin Django), así se prueban solas.

### Estructura

```
backend/
├── common/reservaya_common/   JWT, errores, cliente HTTP, autenticación DRF, ajustes
├── gateway/                   proxy/ (enrutamiento) + config/
├── auth_service/              accounts/ (models, rules, tokens, passwords, google, mailer, services, views)
├── restaurant_service/        catalog/  (models, domain, services, representations, views)
├── reservation_service/       bookings/ (models, domain, availability, clients, services, notifier, views)
├── db/                        schema.sql, migrations/ y cleanup_qa.sql
├── requirements.txt           dependencias (un solo entorno virtual para todo el backend)
├── setup-dev.ps1 · run-dev.ps1 · run-tests.ps1
└── Dockerfile · docker-compose.yml · docker-compose.test.yml · caddy/
```

## Base de datos

El esquema es [`db/schema.sql`](./db/schema.sql) (ver [`db/README.md`](./db/README.md)).
Los modelos de Django son `managed = False`: **Django no crea ni modifica tablas.
No ejecutes `python manage.py migrate` contra Supabase.**

## Puesta en marcha (Windows)

Requisitos: **Python 3.12+**, **Node.js 18+** y, para las pruebas, **Docker
Desktop** (o un PostgreSQL local).

```powershell
cd backend
.\setup-dev.ps1          # crea backend\.venv, instala dependencias y npm install del frontend
# rellena backend\.env (se crea desde .env.example la primera vez)
.\run-dev.ps1 -Frontend  # abre una ventana por servicio + el frontend en http://localhost:3000
```

Si PowerShell bloquea los scripts: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

Para un solo servicio a mano:

```powershell
cd backend\auth_service
..\.venv\Scripts\python manage.py runserver 0.0.0.0:8081
```

Cada servicio lee `backend\.env` al arrancar. El `.env` del backend Spring
anterior sirve tal cual (URL en formato JDBC y variables `SPRING_MAIL_*`
incluidas).

## Pruebas

```powershell
cd backend
.\run-tests.ps1                                   # levanta PostgreSQL 16 en Docker (puerto 5433)
.\run-tests.ps1 -DatabaseUrl "postgresql://postgres:clave@localhost:5432/postgres"   # sin Docker
```

Las pruebas **nunca** se ejecutan contra Supabase (el código se niega). Cargan
`db/schema.sql` en una base de prueba y simulan las llamadas entre servicios.

| Carpeta | Qué prueba |
|---|---|
| `common/tests` | JWT (emisión, firma, emisor, HS512 de Spring), formato de error, URL de la BD, cliente HTTP |
| `auth_service/tests` | Tokens de recuperación (formato compatible con Spring, un solo uso), roles, login con hash `$2a$` de Spring, registro, Google, `/internal/users` |
| `restaurant_service/tests` | Validación de horarios, mensajes de restricciones, marcas, sedes, horario actualizado en su sitio, búsqueda, permisos |
| `reservation_service/tests` | Franjas, iniciales y código, transiciones, regla de 2 horas, aforo, duplicados, panel del restaurante, servicio caído → 503 |
| `gateway/tests` | Enrutamiento, `/internal` oculto, reenvío de método/cuerpo/token, 502, CORS |

### Pruebas manuales contra Supabase

Usa correos `qa+<algo>@reservaya.test` y nombres de restaurante que empiecen por
`QA `. Al terminar, ejecuta [`db/cleanup_qa.sql`](./db/cleanup_qa.sql) en el SQL
Editor de Supabase: borra solo esos registros (y sus sedes y reservas).

## Reglas de negocio

- **Disponibilidad (RF-05):** franjas de 1 h desde la apertura mientras empiecen
  antes del cierre; hoy solo las que aún no empiezan; fecha pasada o día cerrado →
  sin franjas. Cupo = aforo − personas en reservas `PENDING`/`CONFIRMED`.
  Es pública (se consulta antes de iniciar sesión).
- **Crear (RF-06/07):** 1–50 personas, fecha de hoy en adelante, la franja debe
  existir; sin cupo → 409. Un bloqueo consultivo de PostgreSQL por
  (sede, fecha, hora) evita que dos reservas simultáneas superen el aforo.
  Código visible `INICIALES-INICIALES-NNNNNN`.
- **Modificar / cancelar (RF-09):** solo el cliente dueño, solo reservas
  `PENDING`/`CONFIRMED` y con al menos `MIN_HOURS_BEFORE_CANCEL` (2) horas de
  anticipación. Modificar vuelve a `PENDING`; en la misma franja sus propios
  puestos cuentan como libres.
- **Restaurante (RF-10/11):** solo el administrador de la marca dueña de la sede
  (o `SYSTEM_ADMIN`). `PENDING → CONFIRMED | REJECTED`, `CONFIRMED → COMPLETED`.
- Toda acción sobre una reserva queda en `reservation_audit` y el cliente
  recibe un correo (o una línea en el log si no hay SMTP).
- Token ausente, vencido o inválido en una ruta protegida → **401** (el
  frontend vuelve al login).

## Endpoints

Todos con JSON en camelCase. Error: `{status, error, message, timestamp}`.

**auth_service**

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registro de cliente o administrador (RF-01) |
| `POST` | `/api/auth/login` | Devuelve `{token, user}` (RF-02) |
| `GET` | `/api/auth/me` | Datos del usuario autenticado |
| `GET` | `/api/auth/config` | `{googleClientId}` para el frontend |
| `POST` | `/api/auth/google` | Entrar o registrarse con Google (RF-15) |
| `POST` | `/api/auth/forgot-password` | Envía el enlace `…/recuperar?token=` (RF-16) |
| `POST` | `/api/auth/reset-password` | Nueva contraseña con el enlace; devuelve sesión (RF-16) |
| `GET` | `/internal/users?ids=` | Solo entre servicios, con token de administrador |

**restaurant_service**

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/restaurants?name=&city=&cuisine=` | Búsqueda de marcas (RF-04) |
| `GET` | `/api/restaurants?mine=true` | Marcas del administrador autenticado |
| `POST` | `/api/restaurants` | Registrar marca (RF-03, cuenta de restaurante) |
| `PUT` | `/api/restaurants/{id}` | Editar marca (RF-13) |
| `GET` | `/api/restaurants/branches?name=&city=&cuisine=` | Sedes activas con su marca (RF-04) |
| `GET` | `/api/restaurants/branches/{id}` | Ficha de una sede |
| `GET` | `/api/restaurants/{id}/branches` | Sedes de una marca |
| `POST` | `/api/restaurants/{id}/branches` | Crear sede con horarios |
| `PUT` | `/api/restaurants/{id}/branches/{branchId}` | Editar sede y horarios (RF-13) |
| `GET` | `/internal/restaurants/{id}/admins/{userId}` | Solo entre servicios: `{isAdmin}` |

**reservation_service**

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/reservations/availability?branchId=&date=` | Franjas con cupo (RF-05) |
| `POST` | `/api/reservations` | Crear reserva (RF-06, RF-07) |
| `GET` | `/api/reservations` | Reservas del cliente (RF-08) |
| `GET` | `/api/reservations?branchId=&date=` o `&from=&to=` `&status=` | Reservas de la sede con nombre y correo del cliente (RF-10) |
| `PUT` | `/api/reservations/{id}` | Modificar sede, fecha, hora o personas (RF-09) |
| `PATCH` | `/api/reservations/{id}` | Cancelar, con `cancellationReason` opcional (RF-09) |
| `PATCH` | `/api/reservations/{id}/status` | Aceptar / rechazar / completar (RF-11) |

## Despliegue (VM de Oracle Cloud, `reservaya.duckdns.org`)

`docker-compose.yml` levanta los 4 servicios con gunicorn y un Caddy que
**construye el frontend React** y lo sirve con HTTPS, reenviando `/api/*` al
gateway. Las URLs viejas (`/login.html`, `/recuperar.html?token=…`) redirigen a
las rutas nuevas.

Cambio del backend Spring al Django (unos minutos sin servicio, así nunca
escriben los dos backends a la vez en la base):

```bash
ssh <usuario>@<ip-de-la-vm>
cd ReservaYaEP-2026-2/backend
docker compose down                 # 1. detiene Spring + Caddy viejo (con el compose anterior)
cd .. && git fetch && git checkout frontend && git pull && cd backend
# 2. revisa backend/.env: FRONTEND_ORIGIN=https://reservaya.duckdns.org y DOMAIN=reservaya.duckdns.org
docker compose up -d --build        # 3. construye y levanta Django + Caddy con React
docker compose ps                   # 4. todo "running"
curl -s https://reservaya.duckdns.org/api/auth/config   # 5. responde {"googleClientId": ...}
docker image prune -f               # 6. opcional: borra las imágenes de Java
```

Si algo falla, `docker compose logs -f api-gateway auth-service` muestra el
error. Para volver atrás: `docker compose down`, `git checkout <commit anterior>`
y `docker compose up -d --build`.
