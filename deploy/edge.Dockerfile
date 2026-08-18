# syntax=docker/dockerfile:1
# ==========================================================================
# OdontoSaaS — imagem de borda (edge): compila o SPA (React/Vite) e o serve
# pelo Caddy, que também faz o proxy reverso + HTTPS automático.
#
# Build (a partir da RAIZ do repo):
#   docker build -f deploy/edge.Dockerfile -t odonto-edge .
# ==========================================================================

# --- Stage 1: build do frontend (gera os estáticos em /app/dist) ---
FROM node:22-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Caddy servindo o SPA + proxy do Django ---
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
