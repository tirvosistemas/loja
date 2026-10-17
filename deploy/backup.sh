#!/usr/bin/env bash
# Backup da Tirvo: banco (todo dia) e imagens enviadas (1x por semana ou com --full).
# Os arquivos ficam em ./backups e os mais antigos que KEEP_DAYS (padrão 14) são apagados.
#
#   ./deploy/backup.sh           backup do banco (e das imagens aos domingos)
#   ./deploy/backup.sh --full    banco + imagens agora
#
# Para guardar uma cópia fora da VM (recomendado), instale e configure o rclone
# (ex.: Google Drive, Backblaze B2, Oracle Object Storage) e defina no .env:
#   BACKUP_RCLONE_REMOTE=meudrive:tirvo-backups

set -Eeuo pipefail
cd "$(dirname "$0")/.."

KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
COMPOSE="${COMPOSE:-docker compose}"
docker info >/dev/null 2>&1 || COMPOSE="sudo $COMPOSE"

stamp="$(date +%Y%m%d-%H%M)"
log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
# Nunca versionar backups (têm dados de clientes e o .env).
[ -f "$BACKUP_DIR/.gitignore" ] || printf '*\n' >"$BACKUP_DIR/.gitignore"
umask 077

# ───────── Banco de dados
db_file="$BACKUP_DIR/db-$stamp.sql.gz"
trap 'rm -f "$db_file.tmp"' EXIT
log "Backup do banco → $db_file"
# A senha fica só dentro do contêiner (variáveis do serviço mysql).
$COMPOSE exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot \
  --single-transaction --quick --routines --triggers --no-tablespaces --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 --databases "$MYSQL_DATABASE"' | gzip -6 >"$db_file.tmp"
gzip -t "$db_file.tmp"
if [ "$(gzip -dc "$db_file.tmp" | head -c 4096 | grep -c 'MySQL dump')" -eq 0 ]; then
  rm -f "$db_file.tmp"
  log "ERRO: o arquivo gerado não parece um dump do MySQL."
  exit 1
fi
mv "$db_file.tmp" "$db_file"
log "Banco ok ($(du -h "$db_file" | cut -f1))"

# ───────── Imagens (domingo, --full ou se ainda não existe nenhuma cópia)
if [ "${1:-}" = "--full" ] || [ "$(date +%u)" = "7" ] || ! ls "$BACKUP_DIR"/uploads-*.tar.gz >/dev/null 2>&1; then
  if [ -d data/uploads ]; then
    up_file="$BACKUP_DIR/uploads-$stamp.tar.gz"
    log "Backup das imagens → $up_file"
    tar -czf "$up_file" -C data uploads
    log "Imagens ok ($(du -h "$up_file" | cut -f1))"
  fi
fi

# O .env tem a AUTH_SECRET, necessária para ler as chaves salvas no painel.
if [ -f .env ]; then
  cp .env "$BACKUP_DIR/env-latest"
  chmod 600 "$BACKUP_DIR/env-latest"
fi

# ───────── Limpeza
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -print -delete \
  | sed 's/^/  removido: /' || true

# ───────── Cópia externa (opcional)
remote="${BACKUP_RCLONE_REMOTE:-$(env_value BACKUP_RCLONE_REMOTE)}"
if [ -n "$remote" ]; then
  if command -v rclone >/dev/null; then
    log "Enviando para $remote"
    rclone copy "$BACKUP_DIR" "$remote" --include 'db-*.sql.gz' --include 'uploads-*.tar.gz' --include 'env-latest' --max-age 8d
    log "Cópia externa ok"
  else
    log "AVISO: BACKUP_RCLONE_REMOTE definido, mas o rclone não está instalado (sudo apt install rclone)."
  fi
fi

log "Backup concluído."
