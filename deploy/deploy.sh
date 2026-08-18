#!/usr/bin/env bash
# ==========================================================================
# OdontoSaaS — deploy/atualização de produção (idempotente).
# Sobe banco/redis, aplica migrações (shared + tenants), coleta estáticos e
# sobe o restante. Rode a partir da raiz do repo:  bash deploy/deploy.sh
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
	echo "ERRO: falta o arquivo .env na raiz. Copie de deploy/.env.prod.example." >&2
	exit 1
fi

echo "==> Buildando imagens (web + edge)…"
$COMPOSE build

echo "==> Subindo banco e redis…"
$COMPOSE up -d db redis

echo "==> Aguardando o banco ficar saudável…"
until [ "$(docker inspect -f '{{.State.Health.Status}}' odonto_db 2>/dev/null)" = "healthy" ]; do
	sleep 2
done

echo "==> Aplicando migrações (schema public + tenants)…"
$COMPOSE run --rm web python manage.py migrate_schemas

echo "==> Coletando arquivos estáticos (WhiteNoise)…"
$COMPOSE run --rm web python manage.py collectstatic --noinput

echo "==> Subindo a stack completa…"
$COMPOSE up -d

echo "==> Pronto. Status:"
$COMPOSE ps
