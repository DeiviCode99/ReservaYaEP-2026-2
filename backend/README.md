# ReservaYa — Backend

Backend de la plataforma de reservas de restaurantes, en **Spring Boot 4.1.1
(Java 21)** con arquitectura de microservicios y PostgreSQL sobre **Supabase**.

## Servicios

| Servicio | Puerto | Responsabilidad | Requisitos que cubre |
|---|---|---|---|
| `api-gateway` | 8080 | Punto de entrada único, enrutamiento y CORS | RNF-05 |
| `auth-service` | 8081 | Registro, login, Google, recuperación de cuenta, JWT | RF-01, RF-02, RF-14, RF-15, RF-16 |
| `restaurant-service` | 8082 | Marcas, sedes, horarios, búsqueda | RF-03, RF-04, RF-13 |
| `reservation-service` | 8083 | Reservas, disponibilidad, cambios de estado | RF-05 … RF-12 |

Todo el tráfico del frontend entra por el gateway en `http://localhost:8080`.

```
frontend (3000) ──► api-gateway (8080) ──┬──► auth-service (8081) ──┐
                                         ├──► restaurant-service (8082) ├──► Supabase
                                         └──► reservation-service (8083) ┘
                                                    │
                                                    └── consulta aforo y horarios
                                                        a restaurant-service (REST)
```

## Puesta en marcha

### 1. Base de datos

Aplica [`db/schema.sql`](./db/schema.sql) en el SQL Editor de Supabase.
Los detalles están en [`db/README.md`](./db/README.md).

### 2. Variables de entorno

```bash
cp .env.example .env     # y rellena los valores reales
```

El `.env` está en `.gitignore`. Los tres servicios con base de datos leen
`SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` y `JWT_SECRET`
del entorno — no hay credenciales escritas en ningún `application.properties`.

**En Eclipse / STS:** botón derecho sobre el proyecto → *Run As* → *Run
Configurations…* → pestaña **Environment** → *Add* una variable por cada valor.
Hay que hacerlo en las tres configuraciones de arranque.

**En PowerShell** (si prefieres lanzarlos por consola):

```powershell
$env:SUPABASE_DB_URL      = "jdbc:postgresql://...:5432/postgres?sslmode=require"
$env:SUPABASE_DB_USER     = "postgres.xxxxxxxx"
$env:SUPABASE_DB_PASSWORD = "..."
$env:JWT_SECRET           = "..."
.\mvnw spring-boot:run
```

### 3. Arranque rapido (PowerShell)

`run-dev.ps1` carga el `.env` y abre una ventana por servicio:

```powershell
.\run-dev.ps1                                            # los cuatro servicios
.\run-dev.ps1 -Services auth-service, api-gateway -Frontend   # solo registro/login + frontend
```

Omite los servicios cuyo puerto ya este ocupado. Si PowerShell bloquea el
script: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

### 4. Orden de arranque

`auth-service` → `restaurant-service` → `reservation-service` → `api-gateway`.

No es estrictamente obligatorio (el gateway no verifica que los destinos estén
vivos al arrancar), pero evita errores confusos al probar.

## Requisitos del entorno

- **JDK 21 o superior** — Spring Boot 4.x no arranca con JDK 17 ni con 11.
  En Eclipse: *Window → Preferences → Java → Installed JREs*.
- Maven va incluido en cada proyecto (`mvnw` / `mvnw.cmd`), no hace falta
  instalarlo aparte.

## Estado actual

Hecho:

- [x] Los 4 proyectos Maven compilan (BOM de Spring Cloud corregido en el gateway)
- [x] Puertos, datasource de Supabase y JWT configurados por variables de entorno
- [x] Rutas y CORS del gateway
- [x] `db/schema.sql` verificado contra PostgreSQL 16
- [x] Dependencia `jjwt` 0.13.0 en los tres servicios

Pendiente:

- [ ] Entidades JPA y repositorios
- [ ] `auth-service`: registro, login, `SecurityFilterChain`, generación de JWT
- [ ] Filtro de validación de JWT en `restaurant-service` y `reservation-service`
- [ ] Controladores REST y DTOs
- [ ] Lógica de disponibilidad y validación de aforo
- [ ] Pruebas

## Requisitos añadidos (no estaban en la Entrega 1)

| ID | Requisito | Cómo funciona |
|---|---|---|
| RF-15 | Iniciar sesión o registrarse con Google | El navegador obtiene un ID token con Google Identity Services y `auth-service` lo valida con Google (audiencia = `GOOGLE_CLIENT_ID`, correo verificado). Si ya existe una cuenta con ese correo se usa esa; si no, se crea con el tipo de cuenta elegido. |
| RF-16 | Recuperar la cuenta por correo | `forgot-password` envía un enlace que vence en 30 minutos y sirve una sola vez (la firma incluye el hash actual de la contraseña, así que no hace falta tabla nueva). La respuesta es la misma exista o no el correo, para no revelar cuentas. |

Configuración en [`.env.example`](./.env.example): `GOOGLE_CLIENT_ID` y las
variables `SPRING_MAIL_*`. Sin ellas todo sigue funcionando: el botón de
Google no aparece y el enlace de recuperación se escribe en el log de
`auth-service`.

El registro solo acepta los tipos de cuenta `CLIENT` y `RESTAURANT_ADMIN`;
`SYSTEM_ADMIN` no se puede crear desde la API.

## Endpoints

**auth-service**

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registro de cliente o administrador (RF-01) |
| `POST` | `/api/auth/login` | Devuelve el JWT (RF-02) |
| `GET` | `/api/auth/me` | Datos del usuario autenticado |
| `GET` | `/api/auth/config` | Datos públicos para el frontend (`googleClientId`) |
| `POST` | `/api/auth/google` | Entrar o registrarse con Google (RF-15) |
| `POST` | `/api/auth/forgot-password` | Envía el enlace de recuperación por correo (RF-16) |
| `POST` | `/api/auth/reset-password` | Nueva contraseña con el enlace; devuelve sesión (RF-16) |
| `GET` | `/internal/users?ids=` | Nombre y correo de clientes para el panel del restaurante. Solo entre servicios: el gateway no la expone y exige token de administrador |

**restaurant-service**

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/restaurants?name=&city=&cuisine=` | Búsqueda (RF-04) |
| `POST` | `/api/restaurants` | Registrar marca (RF-03, admin) |
| `PUT` | `/api/restaurants/{id}` | Editar marca (RF-13, admin) |
| `GET` | `/api/restaurants?mine=true` | Restaurantes del administrador autenticado |
| `GET` | `/api/restaurants/branches?name=&city=&cuisine=` | Búsqueda de sedes activas con su marca (RF-04) |
| `GET` | `/api/restaurants/{id}/branches` | Sedes de una marca |
| `POST` | `/api/restaurants/{id}/branches` | Crear sede (admin) |
| `PUT` | `/api/restaurants/{id}/branches/{branchId}` | Editar sede y horarios (RF-13) |

**reservation-service**

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/reservations/availability?branchId=&date=` | Franjas con cupo (RF-05) |
| `POST` | `/api/reservations` | Crear reserva, valida aforo (RF-06, RF-07) |
| `GET` | `/api/reservations` | Reservas del cliente autenticado (RF-08) |
| `GET` | `/api/reservations?branchId=&date=&status=` | Reservas de la sede con nombre y correo del cliente (RF-10); solo el administrador de esa sede |
| `PUT` | `/api/reservations/{id}` | Modificar sede, fecha, hora o personas; vuelve a PENDING (RF-09) |
| `PATCH` | `/api/reservations/{id}` | Cancelar (RF-09) |
| `PATCH` | `/api/reservations/{id}/status` | Aceptar / rechazar / completar (RF-11); solo el administrador de esa sede |
