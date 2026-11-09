# ReservaYa Frontend React

Versión React del frontend original de ReservaYa. La carpeta `frontend/` se
conserva sin cambios.

Incluye registro, inicio de sesión, recuperación de cuenta, búsqueda pública
de sedes, reservas y modificaciones del cliente, descarga de confirmación,
notificaciones de cambios de estado, gestión de restaurantes, sedes, horarios,
aforo y reservas del administrador.

## Ejecución

```powershell
cd frontend_react
npm install
npm run dev
```

La aplicación usa el mismo gateway local (`http://localhost:8080`) cuando se
ejecuta en el puerto 3000 y conserva los endpoints del backend actual.

Rutas disponibles: `/`, `/login`, `/recuperar`, `/cliente`, `/sedes` y
`/admin`. `/recuperar?token=...` muestra el formulario para establecer una
nueva contraseña.
