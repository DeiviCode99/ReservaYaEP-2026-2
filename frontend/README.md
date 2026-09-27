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
