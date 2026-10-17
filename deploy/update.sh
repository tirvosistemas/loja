#!/usr/bin/env bash
# Atualiza a loja para a última versão do repositório e reconstrói os contêineres.
# Usado à mão na VM e pelo deploy automático do GitHub (.github/workflows/deploy.yml).
#
#   ./deploy/update.sh             git pull + build + reinício
#   BRANCH=main ./deploy/update.sh

set -Eeuo pipefail
cd "$(dirname "$0")/.."

BRANCH="${BRANCH:-main}"
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"
COMPOSE="${COMPOSE:-$DOCKER compose}"
log() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

# Evita duas atualizações ao mesmo tempo (ex.: dois pushes seguidos).
exec 9>/tmp/tirvo-update.lock
if ! flock -n 9; then
  echo "Outra atualização está em andamento; aguardando..."
  flock 9
fi

[ -f .env ] || { echo "Arquivo .env não encontrado. Rode antes o deploy/oracle-setup.sh." >&2; exit 1; }

log "Baixando a versão mais recente ($BRANCH)"
before="$(git rev-parse --short HEAD)"
git fetch --prune origin "$BRANCH"
git checkout -q "$BRANCH"
git merge --ff-only "origin/$BRANCH"
after="$(git rev-parse --short HEAD)"
chmod +x deploy/*.sh docker/entrypoint.sh 2>/dev/null || true
if [ "$before" = "$after" ]; then
  echo "Já estava na versão $after; reconstruindo mesmo assim."
else
  echo "$before → $after"
  git --no-pager log --oneline "$before..$after" | head -20
fi

log "Construindo e reiniciando"
$COMPOSE up -d --build --remove-orphans
# A imagem de ferramentas (seed e migrações) aproveita o build acima; só é refeita se já existir.
if $DOCKER image inspect tirvo-tools:latest >/dev/null 2>&1; then
  $COMPOSE build tools >/dev/null || echo "Aviso: não foi possível atualizar a imagem de ferramentas."
fi

log "Aguardando o app responder"
status="starting"
for _ in $(seq 1 60); do
  id="$($COMPOSE ps -q app)"
  status="$($DOCKER inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  sleep 5
done
if [ "$status" != "healthy" ]; then
  echo "O app não ficou saudável a tempo. Últimas linhas do log:" >&2
  $COMPOSE logs --tail 60 app >&2 || true
  exit 1
fi
echo "App saudável na versão $after."

log "Limpando imagens antigas"
$DOCKER image prune -f >/dev/null 2>&1 || true
$DOCKER builder prune -f --filter until=168h >/dev/null 2>&1 || true
$COMPOSE ps
