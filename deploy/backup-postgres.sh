#!/usr/bin/env bash
# ==========================================================================
# OdontoSaaS — backup diário do PostgreSQL.
#
# Todos os tenants ficam no MESMO banco (schemas separados), então um único
# pg_dump do banco captura TODAS as clínicas. Formato custom (-Fc) = compacto
# e restaurável com pg_restore.
#
# Cron (diário às 03h):  crontab -e  ->
#   0 3 * * * /opt/odonto/deploy/backup-postgres.sh >> /var/log/odonto-backup.log 2>&1
#
# RECOMENDADO: além do disco local, copie os dumps para FORA do servidor
# (object storage / outro host) — ex.: rclone. Backup no mesmo disco não
# protege contra perda do servidor.
# ==========================================================================
set -euo pipefail

# Carrega POSTGRES_USER/DB e BACKUP_DIR do .env do projeto.
ENV_FILE="${ENV_FILE:-/opt/odonto/.env}"
if [ -f "$ENV_FILE" ]; then
	set -a
	# shellcheck disable=SC1090
	. "$ENV_FILE"
	set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/odonto/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/odonto-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] backup -> $DEST"
# Sem -t/-i: em cron não há TTY, e o pseudo-TTY corromperia o dump binário (-Fc).
docker exec odonto_db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$DEST"

# Poda dumps mais antigos que a retenção.
find "$BACKUP_DIR" -name 'odonto-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "[$(date -Is)] ok ($(du -h "$DEST" | cut -f1))"
