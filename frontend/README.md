# ReservaYaEP-2026-2
Proyecto de aplicativo para reservas de restaurantes para la materia Entornos de Programación

## Frontend: guía de diseño

Identidad "Mantel y brasa": peltre vinotinto, mostaza de letrero y papel cálido.
Todo el estilo vive en `styles/styles.css`, ordenado por secciones numeradas.

**Tokens** (definidos en `:root`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--vino` | `#6b1626` | Color de marca, botones, cabecera |
| `--vino-claro` | `#8e2233` | Estado hover de los botones |
| `--brasa` | `#3a0c16` | Fondos profundos y textos sobre mostaza |
| `--mostaza` | `#e9b23c` | Acento: filete de títulos, foco, distintivos |
| `--papel` / `--papel-hondo` | `#fbf5ea` / `#f2e8d8` | Fondo de página y superficies suaves |
| `--tinta` / `--humo` | `#26161a` / `#7c666b` | Texto principal y secundario |
| `--verde` / `--ladrillo` | `#2e7d57` / `#b23a2b` | Confirmado y error/cancelado |

**Tipografías**: *Alfa Slab One* solo para el logotipo, el titular de portada y
las cifras del resumen; *Epilogue* para títulos, formularios y texto corrido.

**Estructura de páginas**

- `index.html` y `login.html`: pantalla partida (`.auth-layout`), foto con
  lavado vinotinto a la izquierda y formulario sobre papel a la derecha.
- `cliente.html` y `admin.html`: barra vinotinto (`.site-header`), portada con
  título (`.page-head`), tarjetas (`.panel`) en `.dashboard-grid` y estados
  vacíos ilustrados (`.empty-state`).

**Distintivos de estado**: `.badge` acepta `badge-ok` (verde), `badge-warn`
(mostaza), `badge-alert` (ladrillo) y `badge-off` (gris). El color comunica el
estado de la reserva; no es decoración.

Las ilustraciones y el logotipo son SVG en `images/`, así que pesan poco y se
ven nítidos en cualquier pantalla.

## Integración Frontend/Backend

El frontend es estático: `js/server.js` solo sirve HTML, CSS, JavaScript e
imágenes. Las reglas de negocio, autenticación, autorización y persistencia
pertenecen a los microservicios Spring Boot, detrás de `api-gateway`.

### Ejecución local

Desde `frontend/`, ejecuta `npm start`. La aplicación queda en
`http://localhost:3000`. En ese puerto `js/auth.js` dirige las llamadas API a
`http://localhost:8080`, que es el gateway local. El frontend no necesita
variables de entorno propias.

Para ejecutar el backend completo, configura `backend/.env` a partir de
[`backend/.env.example`](../backend/.env.example) y sigue
[`backend/README.md`](../backend/README.md). `backend/run-dev.ps1 -Frontend`
puede iniciar los servicios y el frontend juntos; si el puerto 3000 ya está
ocupado, el script omite iniciar el frontend.

### Contrato de reservas

Las llamadas autenticadas envían `Authorization: Bearer <JWT>` mediante
`authHeaders()` en `js/auth.js`. El backend es la autoridad para roles,
propiedad de la sede, plazo de cancelación y disponibilidad; ocultar o mostrar
controles en el navegador no reemplaza esas validaciones.

| Flujo | Endpoint |
| --- | --- |
| Consultar disponibilidad | `GET /api/reservations/availability?branchId={id}&date=YYYY-MM-DD` |
| Crear reserva | `POST /api/reservations` |
| Consultar reservas propias | `GET /api/reservations` |
| Filtrar reservas de una sede | `GET /api/reservations?branchId={id}&date=YYYY-MM-DD` o `?branchId={id}&from=YYYY-MM-DD&to=YYYY-MM-DD&status=PENDING` |
| Modificar reserva propia | `PUT /api/reservations/{id}` |
| Cancelar reserva propia | `PATCH /api/reservations/{id}` con `cancellationReason` opcional |
| Cambiar estado como administrador | `PATCH /api/reservations/{id}/status` con `{"status":"CONFIRMED"}` |

Estados usados por la API: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED` y
`COMPLETED`. Solo el administrador asociado al restaurante de la sede puede
listar sus reservas y cambiarles el estado.

### Traspaso para despliegue

- Mantén los puertos internos de los microservicios detrás del gateway; el
  navegador debe llamar únicamente a `/api/...`.
- En producción, sirve el frontend y enruta `/api/**` al gateway bajo el mismo
  origen. En ese caso `API_BASE` queda vacío y el gateway debe tener
  `FRONTEND_ORIGIN` configurado para el dominio publicado.
- Para una base existente, aplica
  [`backend/db/migrations/V2__reservation_management.sql`](../backend/db/migrations/V2__reservation_management.sql).
  No vuelvas a ejecutar `backend/db/schema.sql` sobre datos existentes: ese
  archivo elimina y recrea las tablas.
- Configura `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` y el
  mismo `JWT_SECRET` para los servicios que validan tokens. No subas `.env` ni
  credenciales al repositorio.
- Para que lleguen correos de cambio de estado o cancelación, configura las
  variables `SPRING_MAIL_*` y `MAIL_FROM`. Sin SMTP, el backend registra el
  aviso en el log, pero no envía un correo.
