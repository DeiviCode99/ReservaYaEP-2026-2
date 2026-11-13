# Etapa 1: build de produccion del frontend React (frontend/dist).
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Etapa 2: Caddy sirve el build y reenvia /api/* al gateway.
FROM caddy:2
COPY backend/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend /app/dist /srv
