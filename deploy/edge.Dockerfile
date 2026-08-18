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
# --legacy-peer-deps: ignora o conflito de peer (typescript 6 x openapi-typescript
# que pede ^5). O build funciona; é só o npm ci sendo estrito num install limpo.
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Caddy servindo o SPA + proxy do Django ---
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
# Página "em breve" do apex (site institucional/vendas — futuro).
COPY deploy/landing /srv-landing
COPY deploy/Caddyfile /etc/caddy/Caddyfile
