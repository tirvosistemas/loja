#!/bin/sh
# Inicialização dos contêineres app e tools:
#   1. (como root) cria a pasta de imagens e passa o dono para o usuário "node";
#   2. espera o MySQL aceitar conexões;
#   3. aplica as migrações pendentes (RUN_MIGRATIONS=0 desliga);
#   4. executa o comando recebido (padrão do app: node server.js).
set -eu

APP_USER="${APP_USER:-node}"
UPLOAD_DIR="${UPLOAD_DIR:-/app/data/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOAD_DIR"
  # Só mexe no que ainda não é do usuário da aplicação (rápido em pastas grandes).
  find "$UPLOAD_DIR" ! -user "$APP_USER" -exec chown "$APP_USER:$APP_USER" {} + 2>/dev/null || true
  exec setpriv --reuid="$APP_USER" --regid="$APP_USER" --init-groups sh "$0" "$@"
fi

# setpriv mantém o ambiente: corrige o HOME (npm e tsx gravam cache nele).
if [ -z "${HOME:-}" ] || [ "$HOME" = "/root" ]; then export HOME="/home/$APP_USER"; fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[tirvo] DATABASE_URL não definida. Confira o arquivo .env." >&2
  exit 1
fi

# Espera a porta do MySQL abrir (até DB_WAIT_SECONDS, padrão 120 s).
node -e '
const net = require("node:net");
let url;
try { url = new URL(process.env.DATABASE_URL); } catch { console.error("[tirvo] DATABASE_URL inválida."); process.exit(1); }
const host = url.hostname, port = Number(url.port) || 3306;
const deadline = Date.now() + Number(process.env.DB_WAIT_SECONDS || 120) * 1000;
let warned = false;
(function attempt() {
  const s = net.connect({ host, port });
  s.setTimeout(3000);
  s.once("connect", () => { s.end(); process.exit(0); });
  const retry = () => {
    s.destroy();
    if (Date.now() > deadline) { console.error(`[tirvo] MySQL em ${host}:${port} não respondeu a tempo.`); process.exit(1); }
    if (!warned) { console.log(`[tirvo] aguardando o MySQL em ${host}:${port}...`); warned = true; }
    setTimeout(attempt, 2000);
  };
  s.once("error", retry);
  s.once("timeout", retry);
})();
'

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  # A porta abre antes do MySQL terminar de iniciar: tenta algumas vezes.
  n=0
  until node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma; do
    n=$((n + 1))
    if [ "$n" -ge 10 ]; then
      echo "[tirvo] não foi possível aplicar as migrações." >&2
      exit 1
    fi
    echo "[tirvo] nova tentativa de migração em 5 s ($n/10)..."
    sleep 5
  done
fi

exec "$@"
