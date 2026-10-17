#!/usr/bin/env bash
# Restaura um backup feito pelo deploy/backup.sh.
#
#   ./deploy/restore.sh backups/db-20261017-0315.sql.gz
#   ./deploy/restore.sh backups/db-20261017-0315.sql.gz backups/uploads-20261011-0315.tar.gz
#   ./deploy/restore.sh --yes ...     sem pedir confirmação
#
# O banco atual é APAGADO e substituído pelo backup. As imagens atuais vão para
# data/uploads.antes-<data> (apague depois de conferir).

set -Eeuo pipefail
cd "$(dirname "$0")/.."

COMPOSE="${COMPOSE:-docker compose}"
docker info >/dev/null 2>&1 || COMPOSE="sudo $COMPOSE"

yes=0
files=()
for arg in "$@"; do
  case "$arg" in
    --yes|-y) yes=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) files+=("$arg") ;;
  esac
done

db_file=""
up_file=""
for f in "${files[@]}"; do
  [ -f "$f" ] || { echo "Arquivo não encontrado: $f" >&2; exit 1; }
  case "$f" in
    *.sql.gz) db_file="$f" ;;
    *.tar.gz) up_file="$f" ;;
    *) echo "Formato não reconhecido: $f (use db-*.sql.gz e/ou uploads-*.tar.gz)" >&2; exit 1 ;;
  esac
done
if [ -z "$db_file" ] && [ -z "$up_file" ]; then
  echo "Uso: ./deploy/restore.sh backups/db-AAAAMMDD-HHMM.sql.gz [backups/uploads-AAAAMMDD-HHMM.tar.gz]" >&2
  echo "Backups disponíveis:" >&2
  ls -1t backups 2>/dev/null | head -20 | sed 's/^/  /' >&2 || true
  exit 1
fi

echo "Vai restaurar:"
[ -n "$db_file" ] && echo "  banco:   $db_file  (o banco atual será apagado)"
[ -n "$up_file" ] && echo "  imagens: $up_file"
if [ "$yes" != 1 ]; then
  read -r -p "Digite RESTAURAR para continuar: " answer
  [ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
fi

if [ -n "$db_file" ]; then
  gzip -t "$db_file"
  echo "▸ Parando o app e conferindo o MySQL"
  $COMPOSE stop app >/dev/null 2>&1 || true
  $COMPOSE up -d mysql
  for _ in $(seq 1 30); do
    $COMPOSE exec -T mysql sh -c 'mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent' >/dev/null 2>&1 && break
    sleep 3
  done

  echo "▸ Recriando o banco"
  $COMPOSE exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"'
  echo "▸ Importando $db_file"
  gzip -dc "$db_file" | $COMPOSE exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4'
  echo "  Banco restaurado."
fi

if [ -n "$up_file" ]; then
  echo "▸ Restaurando imagens"
  tar -tzf "$up_file" >/dev/null
  if [ -d data/uploads ]; then
    old="data/uploads.antes-$(date +%Y%m%d-%H%M%S)"
    mv data/uploads "$old"
    echo "  Imagens atuais guardadas em $old"
  fi
  mkdir -p data
  tar -xzf "$up_file" -C data
  echo "  Imagens restauradas em data/uploads."
fi

echo "▸ Iniciando o app (migrações novas são aplicadas sozinhas)"
$COMPOSE up -d app
echo "Pronto."
