#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Backup do banco PostgreSQL do Construlog.
#
# - Ligado/desligado pela variável CRONTAB_ON no .env (true/false).
# - Faz pg_dump comprimido em backups/ com rotação (mantém os últimos N).
# - Opcionalmente envia para a nuvem via rclone (Backblaze B2, Google Drive, etc.)
#   quando BACKUP_RCLONE_REMOTE estiver definido no .env.
#
# Agendado no crontab do host (o cron sempre dispara; quem decide rodar ou não
# é o CRONTAB_ON). Ex.: 0 3 * * * /root/construlog/scripts/backup-db.sh >> ...
# ---------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/root/construlog"
cd "$APP_DIR"

log() { echo "$(date '+%F %T') [backup] $*"; }

# Lê uma chave do .env SEM executar o arquivo (valores podem conter caracteres
# especiais que quebrariam `source`). Remove aspas envolventes se houver.
getenv() {
  grep -E "^${1}=" "$APP_DIR/.env" 2>/dev/null | head -n1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true
}

CRONTAB_ON="$(getenv CRONTAB_ON)"
POSTGRES_USER="$(getenv POSTGRES_USER)"
POSTGRES_PASSWORD="$(getenv POSTGRES_PASSWORD)"
POSTGRES_DB="$(getenv POSTGRES_DB)"
BACKUP_DIR="$(getenv BACKUP_DIR)"
BACKUP_KEEP="$(getenv BACKUP_KEEP)"
BACKUP_RCLONE_REMOTE="$(getenv BACKUP_RCLONE_REMOTE)"

# Chave liga/desliga
if [ "${CRONTAB_ON:-false}" != "true" ]; then
  log "CRONTAB_ON != true — backup desativado, saindo."
  exit 0
fi

BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP="${BACKUP_KEEP:-14}"                # quantos backups manter (local e nuvem)
REMOTE="${BACKUP_RCLONE_REMOTE:-}"       # ex.: b2backup:meu-bucket/construlog-db
STAMP="$(date '+%Y%m%d-%H%M%S')"
FILE="$BACKUP_DIR/construlog-db-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

log "iniciando pg_dump -> $FILE"
# pg_dump roda DENTRO do container db (a imagem postgres já tem pg_dump).
# PGPASSWORD garante a autenticação independente do pg_hba.
if ! docker compose exec -T -e PGPASSWORD="${POSTGRES_PASSWORD}" db \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists \
  | gzip -9 > "$FILE"; then
  log "ERRO: pg_dump falhou — removendo $FILE"
  rm -f "$FILE"
  exit 1
fi

# Falha se o dump saiu vazio/corrompido
if [ ! -s "$FILE" ] || ! gzip -t "$FILE" 2>/dev/null; then
  log "ERRO: dump vazio ou corrompido — removendo $FILE"
  rm -f "$FILE"
  exit 1
fi
log "dump ok ($(du -h "$FILE" | cut -f1))"

# Rotação local: mantém os últimos $KEEP
ls -1t "$BACKUP_DIR"/construlog-db-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
log "rotação local: mantendo os últimos $KEEP"

# Upload opcional para a nuvem
if [ -n "$REMOTE" ]; then
  log "enviando para $REMOTE"
  rclone copy "$FILE" "$REMOTE" --no-traverse
  # Rotação na nuvem: mantém os últimos $KEEP
  rclone lsf "$REMOTE" --include 'construlog-db-*.sql.gz' 2>/dev/null | sort -r | tail -n +"$((KEEP + 1))" \
    | while read -r f; do rclone deletefile "$REMOTE/$f" 2>/dev/null || true; done
  log "upload concluído"
else
  log "BACKUP_RCLONE_REMOTE vazio — backup somente local"
fi

log "concluído."
