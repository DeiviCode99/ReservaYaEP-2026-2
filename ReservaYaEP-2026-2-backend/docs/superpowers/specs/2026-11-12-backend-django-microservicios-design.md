# ReservaYa: backend Django con microservicios + frontend React — Diseño

**Fecha:** 2026-11-12 · **Rama:** `frontend` · **Autor:** David Zapata (con Claude)

## 1. Intención

La entrega pide frontend en **React** y backend en un framework **distinto de
Spring Boot**. El equipo eligió **Django** y conservar la arquitectura de
**microservicios** que ya está documentada en el SRS. La rama `frontend` debe
quedar con solo el frontend React (el que hizo un compañero en `frontend_react/`)
y un backend Django que cumpla las mismas reglas de negocio que el backend
Spring actual, sobre la misma base de datos de Supabase.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- Reemplazar `api-gateway`, `auth-service`, `restaurant-service` y
  `reservation-service` (Spring) por cuatro proyectos Django con el **mismo
  contrato HTTP**: rutas, métodos, nombres de campos en camelCase, códigos de
  estado y forma del error `{status, error, message, timestamp}`.
- Usar la **misma base de datos de Supabase y las mismas tablas** sin cambiar el
  esquema.
- Que los **usuarios existentes sigan entrando** (hashes BCrypt `$2a$` de Spring).
- Que el frontend React funcione **sin tocar `src/lib/api.js`**, y completar en
  React lo que haga falta (ver §6).
- Pruebas automatizadas de las reglas de negocio (equivalentes a las pruebas
  Java actuales y más).
- Despliegue con `docker-compose` + Caddy actualizado (servicios Python y build
  de React).

**No objetivos**
- Base de datos por servicio, eventos o colas.
- Cambiar el esquema o los datos de producción.
- Funcionalidades nuevas (pagos, reseñas, administrador global).
- Rediseñar el frontend.
- Django admin, sesiones, plantillas.

**Anti-objetivos** (fallaría aunque "funcione")
- Que un usuario creado con el backend Spring no pueda iniciar sesión.
- Que Django ejecute migraciones sobre Supabase (ni siquiera la tabla
  `django_migrations`).
- Tener que reescribir llamadas del React porque cambió un JSON.
- Secretos en el repositorio.

## 3. Restricciones

- Supabase: pooler en modo sesión (puerto 5432), conexiones limitadas en el plan
  gratuito. Hay 3 servicios con base de datos.
- Zona horaria de negocio: `America/Bogota`.
- Desarrollo en Windows (PowerShell); producción en una VM Linux (Oracle Cloud)
  con Docker.
- El frontend corre en `http://localhost:3000` y llama al gateway en
  `http://localhost:8080` (lógica de `API_BASE` en `api.js`).
- La sesión que escribió este documento no tenía acceso a PyPI ni a npm. La
  **implementación se hace en un chat nuevo con instalación de paquetes
  habilitada**, donde se ejecutan las pruebas y el build en cada etapa.

## 4. Enfoques considerados

| Enfoque | Qué es | A favor | En contra |
|---|---|---|---|
| **A. Mismos microservicios en Django (elegido)** | 3 servicios Django + DRF y un gateway Django; misma BD compartida, cada servicio dueño de sus tablas, comunicación HTTP | Igual a la arquitectura documentada; React sin cambios; sin migrar datos | 4 procesos en local (se resuelve con script y docker-compose) |
| B. Una base de datos por servicio | Esquemas separados, sin FK entre servicios | Más "puro" | Migrar datos de producción y romper FK `reservations → users/branches`; mucho riesgo para la entrega |
| C. Un solo proyecto Django con 3 apps | Monolito modular | Lo más simple | Deja de ser microservicios |

David eligió **A**.

## 5. Diseño del backend

### 5.1 Estructura

```
backend/
  common/reservaya_common/   # paquete compartido: auth JWT, errores, respuestas, cliente HTTP
  gateway/                   # Django, puerto 8080
  auth_service/              # Django, puerto 8081  (tabla users)
  restaurant_service/        # Django, puerto 8082  (restaurants, branches, schedules, restaurant_admins)
  reservation_service/       # Django, puerto 8083  (reservations, reservation_audit)
  db/                        # schema.sql y migrations/ SIN CAMBIOS
  requirements.txt  requirements-dev.txt  pytest.ini
  Dockerfile  docker-compose.yml  docker-compose.test.yml  caddy/Caddyfile
  run-dev.ps1  .env.example  README.md
```

Cada servicio es un proyecto Django independiente (`manage.py`, `settings.py`,
`urls.py`, una app con `models.py`, `services.py`, `views.py`, `serializers.py`,
`tests/`). Las reglas de negocio viven en `services.py` (no en las vistas), como
en Spring.

### 5.2 Pila

- Python 3.12, Django 5.2 LTS, Django REST Framework, `psycopg[binary]` 3,
  `PyJWT`, `bcrypt`, `django-cors-headers` (solo gateway), `gunicorn`.
- Pruebas: `pytest`, `pytest-django`.
- Sin `django.contrib.auth`, `admin`, `sessions` ni `contenttypes`.
- Configuración solo por variables de entorno (mismas que hoy cuando aplica; ver §5.10).

### 5.3 Base de datos

- Modelos con `managed = False` y `db_table` igual a `schema.sql`. Nunca se
  ejecuta `migrate` contra Supabase.
- Cada servicio declara solo los modelos de sus tablas. `reservation_service`
  no lee `branches` ni `users` directamente: los pide por HTTP (igual que hoy).
- `DATABASES` desde `SUPABASE_DB_URL` (formato `postgresql://...`; se acepta
  también el formato JDBC actual quitándole el prefijo `jdbc:`),
  `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `sslmode=require`,
  `CONN_MAX_AGE=60`, `CONN_HEALTH_CHECKS=True`, `TIME_ZONE='America/Bogota'`,
  `USE_TZ=True`.
- `updated_at` lo mantiene el trigger existente; Django no lo escribe.
- **Mejora de concurrencia (aforo):** al crear o modificar una reserva, dentro
  de la transacción se toma `pg_advisory_xact_lock` sobre
  `(branch_id, fecha, hora)` antes de sumar el cupo, para que dos reservas
  simultáneas no superen el aforo. No cambia el esquema. (El backend Spring
  no lo hacía.)

### 5.4 Autenticación y JWT

- Firma HS256 con `JWT_SECRET` (mínimo 32 caracteres), `iss = JWT_ISSUER`
  (`reservaya-auth`), expiración `JWT_EXPIRATION_MINUTES` (120).
  Claims: `sub` (id como texto), `email`, `name`, `role`, `iat`, `exp`.
- Verificación: se aceptan HS256/HS384/HS512 (jjwt elegía el algoritmo según el
  largo de la clave) y se exige el emisor.
- Clase de autenticación DRF compartida (`reservaya_common`) que convierte el
  token en un `AuthenticatedUser(id, email, name, role)`. Token ausente o
  inválido en una ruta protegida → **401** con el JSON de error (Spring
  devolvía 403 vacío; con 401 el frontend redirige al login, que es lo que
  espera `api.js`).
- Contraseñas: `bcrypt.checkpw` (acepta `$2a$` de Spring); hashes nuevos con
  `bcrypt.gensalt(rounds=10)`. Contraseña 8–72 caracteres.

### 5.5 Reglas por servicio (paridad con Spring)

**auth_service** (`users`)
- `POST /api/auth/register` (201): nombre 2–80, correo válido (regex actual) y
  en minúsculas, contraseña 8–72, rol solo `CLIENT` o `RESTAURANT_ADMIN`
  (vacío → `CLIENT`; otro → 400 "Tipo de cuenta no válido."). Correo repetido → 409.
- `POST /api/auth/login`: credenciales inválidas → 401.
- `GET /api/auth/me`, `GET /api/auth/config` → `{googleClientId}`.
- `POST /api/auth/google`: valida el ID token con el endpoint `tokeninfo` de
  Google (`aud`, `iss`, `email_verified`); usa la cuenta existente o crea una
  con el rol elegido y contraseña aleatoria.
- `POST /api/auth/forgot-password`: misma respuesta exista o no el correo.
  Token `id.expira.firma` con HMAC-SHA256 sobre `id|expira|password_hash` y
  clave `"password-reset:" + JWT_SECRET`, base64url sin relleno, 30 min,
  de un solo uso. **Enlace: `FRONTEND_ORIGIN/recuperar?token=...`** (antes
  `/recuperar.html`, que en React no existe). Sin SMTP el enlace va al log.
- `POST /api/auth/reset-password`: cambia la contraseña y devuelve sesión.
- `GET /internal/users?ids=1,2`: `[{id,name,email}]`, exige token de
  `RESTAURANT_ADMIN` o `SYSTEM_ADMIN`. No pasa por el gateway.
- Respuesta de sesión: `{token, user:{id,name,email,role,createdAt}}`.

**restaurant_service** (`restaurants`, `branches`, `schedules`, `restaurant_admins`)
- Los `GET /api/restaurants/**` son públicos; el resto exige token.
- `GET /api/restaurants?name=&city=&cuisine=` y `?mine=true` (sin token → 403).
- `POST /api/restaurants` (201) crea la marca y vincula al usuario en
  `restaurant_admins`; nombre único sin importar mayúsculas (409).
- `PUT /api/restaurants/{id}`: solo su administrador o `SYSTEM_ADMIN`.
- `GET /api/restaurants/branches?name=&city=&cuisine=`: solo sedes activas,
  ciudad exacta sin mayúsculas, nombre y cocina por "contiene", orden marca →
  sede. `GET /api/restaurants/branches/{id}`, `GET /api/restaurants/{id}/branches`.
- `POST|PUT /api/restaurants/{id}/branches[/{branchId}]`: validación de
  horarios igual que hoy (día repetido, horas faltantes, cierre ≤ apertura →
  400 con el mismo mensaje); el horario se actualiza en su sitio por día
  (insertar nuevos, actualizar existentes, borrar los que no vienen); día
  cerrado sin horas guarda 00:00; capacidad 1–500; nombre de sede único por
  marca (409).
- Errores de restricciones de la BD → 409 con los mensajes del mapa actual,
  que incluye también los nombres heredados del esquema viejo de producción
  (p. ej. `schedules_day_of_week_check`), por si producción no coincide al
  100 % con `schema.sql`.
- **Interno:** `GET /internal/restaurants/{id}/admins/{userId}` → `{isAdmin}`.
  Reemplaza a `/api/restaurants/{id}/verify-admin`, que hoy es público a
  través del gateway (cualquiera podía consultar quién administra qué).

**reservation_service** (`reservations`, `reservation_audit`)
- `GET /api/reservations/availability?branchId=&date=`: sede inactiva → 404;
  día sin horario, cerrado o fecha pasada → `slots: []`; franjas de 1 h desde
  la apertura mientras `hora < cierre`; hoy solo franjas que aún no empiezan;
  disponible = aforo − suma de `party_size` en `PENDING|CONFIRMED`
  (mínimo 0); se corta el ciclo al pasar de medianoche.
- `POST /api/reservations` (201): fecha no pasada, 1–50 personas, evento
  `NONE|ROMANTIC_DINNER|BIRTHDAY|WEDDING`; la franja debe existir en la
  disponibilidad (si no → 422); sin cupo → 409 "No hay cupo suficiente.
  Disponible: N personas."; guarda `customer_email` del token; código
  `INICIALES_CLIENTE-INICIALES_RESTAURANTE-NNNNNN` con la misma regla de
  iniciales (sin tildes, una palabra → 3 letras, varias → primera y última);
  estado `PENDING`; auditoría `CREATED`. Reserva activa repetida en la misma
  franja → 409.
- `GET /api/reservations`: del cliente, orden fecha y hora descendente.
  Con `branchId` + `date` o `from/to` (+ `status` opcional): reservas de la
  sede para su administrador, con `customerName` y `customerEmail` pedidos a
  auth (si auth falla, se devuelven sin esos datos), ordenadas por hora.
  Filtros de fecha sin sede → 422.
- `PUT /api/reservations/{id}` (modificar) y `PATCH /api/reservations/{id}`
  (cancelar con `cancellationReason` opcional): solo rol `CLIENT`, solo su
  reserva, solo `PENDING|CONFIRMED`, con al menos `MIN_HOURS_BEFORE_CANCEL`
  (2) horas de anticipación (horas completas, como `ChronoUnit.HOURS`). Al
  modificar en la misma franja sus propios puestos cuentan como libres; vuelve
  a `PENDING`. Auditoría `MODIFIED` / `CANCELLED` y notificación al cliente.
- `PATCH /api/reservations/{id}/status`: solo el administrador de la marca de
  la sede o `SYSTEM_ADMIN`; transiciones `PENDING → CONFIRMED|REJECTED`,
  `CONFIRMED → COMPLETED`, cualquier otra → 422; guarda motivo; auditoría
  `STATUS_CHANGED`; notificación con las etiquetas en español.
- Notificaciones por correo con `send_mail`; sin SMTP se escriben en el log.

### 5.6 Formato de respuestas

- Campos en camelCase, exactamente como los records Java (§5.5 y
  `ReservationResponse`, `BranchResponse`, `RestaurantResponse`,
  `ScheduleResponse`, `AvailabilityResponse`, `TimeSlot`).
- Fechas `YYYY-MM-DD`, horas `HH:MM:SS`, marcas de tiempo ISO 8601 con zona,
  latitud/longitud como número.
- Error: `{status, error, message, timestamp}`. Validación → 400 con
  `campo: mensaje; ...`. Error no controlado → 500 "Error interno del servidor."
  (detalle solo en el log).

### 5.7 Comunicación entre servicios

- Cliente HTTP compartido (`urllib` de la biblioteca estándar, timeout 5 s).
- reservation → restaurant: `GET /api/restaurants/branches/{id}` (404 →
  "Sede no encontrada") y `GET /internal/restaurants/{id}/admins/{userId}`.
- reservation → auth: `GET /internal/users?ids=` reenviando el token del
  administrador.
- Caída de restaurant_service → 503 con el JSON de error.

### 5.8 Gateway

- Django mínimo (sin base de datos) en el 8080. Reenvía `/api/auth/*`,
  `/api/restaurants/*`, `/api/reservations/*` a cada servicio con método, query,
  cuerpo y cabeceras (`Authorization`, `Content-Type`); devuelve estado y
  cuerpo tal cual. Destino caído → 502 JSON.
- CORS con `django-cors-headers` para `FRONTEND_ORIGIN`.
- `/internal/*` no se expone. `GET /health` en cada servicio.

### 5.9 Pruebas

- `pytest` + `pytest-django` por servicio contra un PostgreSQL 16 **local** de
  prueba (el del entorno de trabajo o `docker-compose.test.yml`); las pruebas
  automáticas **nunca** apuntan a Supabase; un fixture carga `db/schema.sql` en la base de
  prueba (los modelos son `managed=False`). Las llamadas HTTP a otros servicios
  se simulan.
- Cobertura mínima: las 4 pruebas Java actuales portadas
  (`AccountFlowTest`, `BranchUpdateTest`, `ReservationFlowTest`,
  `BranchReservationFlowTest`) más: login con un hash BCrypt en formato
  `$2a$10$` como los de Spring (se genera en la prueba y se le pone el prefijo
  `$2a$`, que es el mismo algoritmo), claims del JWT, token de recuperación de un solo uso, aforo,
  regla de 2 horas, transiciones de estado, acceso del administrador a la sede,
  y forma del JSON de respuesta y de error.

### 5.10 Configuración, ejecución y despliegue

- `.env.example` conserva las variables actuales (`SUPABASE_DB_*`,
  `JWT_*`, puertos, `*_SERVICE_URI`, `FRONTEND_ORIGIN`,
  `MIN_HOURS_BEFORE_CANCEL`, `GOOGLE_CLIENT_ID`, `RESET_EXPIRATION_MINUTES`,
  `MAIL_FROM`) y cambia `SPRING_MAIL_*` por `EMAIL_HOST`, `EMAIL_PORT`,
  `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`. Se añade `DJANGO_DEBUG`.
- `run-dev.ps1`: carga `.env`, usa `backend/.venv` y abre una ventana por
  servicio con `python manage.py runserver`; `-Frontend` lanza `npm run dev`.
- Docker: una imagen `python:3.12-slim` con `gunicorn` (2 workers) por
  servicio vía build-arg `SERVICE`. Caddy sirve el **build de React**
  (imagen propia con etapa `node` que hace `npm run build`) con
  `try_files {path} /index.html` y reenvía `/api/*` al gateway. Las URLs
  viejas `*.html` redirigen a las rutas de React (`/login.html → /login`,
  `/recuperar.html?token= → /recuperar?token=`, etc.).

## 6. Frontend

- Se borra `frontend/` (vanilla) y `frontend_react/` pasa a llamarse
  `frontend/`. Se actualizan las rutas que lo mencionan (README, compose,
  Caddy, script).
- Funcionalidad: React ya cubre todos los endpoints que usaba el vanilla. Al
  implementar se compara pantalla por pantalla con `frontend/` vanilla
  (antes de borrarlo) y lo que falte se agrega en React con el sistema de
  diseño existente.
- Se actualiza `README.md` del frontend (ya no dice "el backend no se
  modifica").

## 7. Repositorio

- Antes de empezar se descartan los 61 cambios que son **solo fin de línea**
  (contenido idéntico) y se agrega `.gitattributes` para que no reaparezcan.
- Se borran el backend Java (`*-service/`, `api-gateway/`, `target/`) y el
  frontend vanilla.
- Se actualizan el `README.md` raíz y `docs/SRS-ReservaYa.md` donde mencionan
  Spring Boot.
- Commits locales por etapa en la rama `frontend`; el `push` se hace al final,
  cuando haga falta para desplegar en la VM.

## 8. Decisiones de David

- **Implementación** en un chat nuevo con red, ejecutando pruebas y build.
- **Pruebas manuales contra Supabase de producción.** Los datos que se creen
  usan correos `qa+<algo>@reservaya.test` y nombres de restaurante con prefijo
  `QA `; al final se ejecuta `backend/db/cleanup_qa.sql`, que borra solo esos
  registros (las reservas y la auditoría caen por `ON DELETE CASCADE`).
- **El despliegue entra en el trabajo:** reemplazar Spring por Django en la VM
  de Oracle (`reservaya.duckdns.org`). Corte: se detienen los contenedores
  Spring y se levantan los de Django (minutos sin servicio), así nunca
  escriben los dos backends a la vez. Si no se puede entrar a la VM desde la
  sesión, se entrega un instructivo paso a paso para que el equipo lo ejecute.
- **Prioridad:** 1) backend Django + React funcionando en local contra
  Supabase; 2) despliegue en la VM; 3) Docker/Caddy pulido y pruebas extra.
  Fecha de entrega no indicada.

## 9. Decisiones que tomé yo (revisar)

1. Paquete compartido `reservaya_common` en vez de duplicar JWT y errores en
   cada servicio.
2. 401 (no 403) para token ausente o inválido.
3. Endpoint interno `/internal/restaurants/{id}/admins/{userId}` en lugar del
   `verify-admin` público.
4. Bloqueo consultivo de PostgreSQL para el aforo.
5. Enlace de recuperación `/recuperar?token=` y redirecciones de URLs `.html`.
6. Renombrar `frontend_react/` a `frontend/`.
7. Variables `EMAIL_*` en lugar de `SPRING_MAIL_*`.
8. Commits locales por etapa; push solo para el despliegue.
9. Mensajes de 409 que reconocen nombres de restricciones nuevos y heredados.
10. Prueba de compatibilidad BCrypt con un hash `$2a$10$` generado en la prueba.

## 10. Lo que queda al implementador

Nombres internos de módulos y funciones, organización de los tests, mensajes de
log, detalles del script de PowerShell y del Dockerfile, siempre que se
respeten el contrato HTTP y las reglas de §5.5.
