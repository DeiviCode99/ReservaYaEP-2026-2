# ReservaYa · Frontend React

Frontend de ReservaYa en React 18 + Vite + Tailwind CSS v4. La carpeta
`frontend/` (HTML sin framework) se conserva como legado y no se modifica.

## Ejecución

```powershell
cd frontend_react
npm install
npm run dev        # http://localhost:3000, contra el gateway en http://localhost:8080
npm run dev:demo   # igual, pero con datos de ejemplo en memoria (sin backend)
npm run build      # build de producción en dist/
```

En el modo demo se entra con cualquier correo y contraseña; si el correo
contiene `admin` o `restaurante`, la cuenta es de administrador. El modo demo
vive en `src/lib/demo.js` y no se incluye en el build de producción.

## Rutas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Landing con buscador y sedes destacadas | Público |
| `/sedes` | Búsqueda de sedes (nombre, ciudad, cocina) con paginación | Público |
| `/sedes/:id` | Ficha de sede, galería y flujo de reserva | Público (reservar exige cuenta de cliente) |
| `/login`, `/registro`, `/recuperar` | Acceso; `/recuperar?token=...` define una contraseña nueva | Público |
| `/cliente` | Mis reservas: activas, historial, modificar, cancelar, PDF | Rol `CLIENT` |
| `/admin` | Reservas de las sedes, restaurantes, sedes, horarios y aforo | Rol `RESTAURANT_ADMIN` |

## Estructura

```
src/
  index.css          Tokens del sistema de diseño (@theme de Tailwind)
  main.jsx           Rutas (carga diferida por pantalla) y rutas protegidas
  lib/               api.js (contrato con el backend), formato, PDF, notificaciones, fotos
  components/ui/     Button, Input, Select, Badge, Card, Modal, Skeleton, Toast, EmptyState
  components/        Carousel, Gallery, Lightbox, BranchCard, ReservationCard, DatePicker, TimeSlots, BookingPanel…
  layouts/           SiteLayout (header, menú móvil, pie) y AuthLayout
  pages/             Una pantalla por archivo
```

## Contrato con el backend

`src/lib/api.js` conserva `apiFetch`, la sesión en `localStorage`
(`reservaya.session`), el token Bearer, la redirección a `/login` ante un 401,
`API_BASE` (puerto 3000 → `http://localhost:8080`), los mapas `STATUS` y
`EVENTS`, y `formatDate` / `todayIso`. El backend no se modifica.

## Paleta

| Token | Color | Uso |
|---|---|---|
| `crema` | `#F5F5DC` | Fondos y superficies |
| `mostaza` | `#FBC02D` | Acentos, seleccionados, resaltados |
| `naranja` | `#FF8F00` | Acción principal y foco |
| `rojo` | `#C62828` | Marca, títulos, errores y cancelaciones |

Cada color tiene escala 50–900 en `src/index.css`, junto con los neutros
cálidos (`tinta`, `piedra`, `papel`) y el verde `exito`.

## Fotos

El backend aún no guarda fotos de las sedes. `src/lib/images.js` asigna fotos
de referencia (Unsplash, licencia libre) según el tipo de cocina; cuando el
backend entregue imágenes basta con cambiar `photosFor()`.
