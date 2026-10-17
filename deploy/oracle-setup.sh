#!/usr/bin/env bash
# Prepara uma VM Ubuntu 22.04/24.04 (Oracle Cloud Always Free, Ampere A1) e coloca a
# Tirvo no ar com Docker, MySQL e HTTPS automático (Caddy). Pode rodar de novo quando
# quiser: o que já estiver feito é mantido.
#
# Uso (como o usuário padrão da VM, ex.: ubuntu, sem sudo):
#   bash oracle-setup.sh https://github.com/SEU-USUARIO/tirvo-loja.git
#
# Variáveis opcionais (para rodar sem perguntas):
#   DOMAIN=loja.exemplo.com.br ADMIN_EMAIL=voce@exemplo.com.br APP_DIR=~/tirvo-loja
#   DEMO=1  carrega a loja de demonstração (produtos, banners e pedidos de exemplo)

set -Eeuo pipefail

REPO_URL="${1:-${REPO_URL:-}}"
BRANCH="${BRANCH:-main}"
# Rodando de dentro de um clone do repositório: usa essa pasta.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -z "${APP_DIR:-}" ] && [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../docker-compose.yml" ] && [ -d "$SCRIPT_DIR/../.git" ]; then
  APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
APP_DIR="${APP_DIR:-$HOME/tirvo-loja}"

info() { printf '\n\033[1;38;5;202m▸\033[0m \033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
trap 'die "Falhou na linha $LINENO. Corrija o problema e rode o script de novo."' ERR

# Pergunta mesmo quando o script vem por "curl ... | bash".
ask() {
  local prompt="$1" default="${2:-}" answer=""
  if [ -r /dev/tty ]; then
    read -r -p "  $prompt${default:+ [$default]}: " answer </dev/tty || true
  fi
  printf '%s' "${answer:-$default}"
}

if [ "$(id -u)" -eq 0 ]; then
  [ -n "${SUDO_USER:-}" ] && die "Rode sem sudo, com o seu usuário (ex.: ubuntu). O script pede sudo quando precisa."
  SUDO=""
else
  command -v sudo >/dev/null || die "sudo não encontrado."
  SUDO="sudo"
  $SUDO -v || die "Seu usuário precisa de permissão de sudo."
fi

. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "Feito para Ubuntu 22.04/24.04; este sistema é ${PRETTY_NAME:-desconhecido}."
ARCH="$(dpkg --print-architecture)"
# apt sem perguntas (o sudo não repassa variáveis de ambiente, por isso o "env").
apt_get() {
  $SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get -q -y \
    -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold "$@"
}

# ───────────────────────────── Sistema
info "Atualizando o sistema (pode levar alguns minutos)"
apt_get update
apt_get upgrade
apt_get install ca-certificates curl gnupg git openssl cron unattended-upgrades
ok "Pacotes atualizados"

info "Fuso horário"
$SUDO timedatectl set-timezone America/Sao_Paulo || warn "Não foi possível mudar o fuso horário."
ok "America/Sao_Paulo"

info "Memória swap de 2 GB"
if swapon --show=NAME --noheadings | grep -q .; then
  ok "Swap já existe"
else
  $SUDO fallocate -l 2G /swapfile 2>/dev/null || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  ok "Swap criado em /swapfile"
fi
echo 'vm.swappiness=10' | $SUDO tee /etc/sysctl.d/99-tirvo.conf >/dev/null
$SUDO sysctl -q -p /etc/sysctl.d/99-tirvo.conf || true

info "Atualizações automáticas de segurança"
$SUDO tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
$SUDO tee /etc/apt/apt.conf.d/52tirvo-unattended >/dev/null <<'EOF'
// Reinicia de madrugada quando uma atualização (ex.: kernel) exigir. Os contêineres voltam sozinhos.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
$SUDO systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
ok "Ativadas (reinício automático às 04:30 quando necessário)"

# ───────────────────────────── Firewall da VM
# As imagens Ubuntu da Oracle têm regras iptables que recusam tudo além da porta 22.
# As liberações entram antes da regra REJECT, agora e no arquivo que o
# netfilter-persistent carrega ao ligar a VM.
info "Liberando as portas 80 e 443 no firewall da VM"
if ! dpkg -s iptables-persistent >/dev/null 2>&1; then
  echo iptables-persistent iptables-persistent/autosave_v4 boolean false | $SUDO debconf-set-selections
  echo iptables-persistent iptables-persistent/autosave_v6 boolean false | $SUDO debconf-set-selections
  apt_get install iptables-persistent netfilter-persistent >/dev/null
fi
open_port() {
  local proto="$1" port="$2"
  local rule=(-p "$proto" -m state --state NEW -m "$proto" --dport "$port" -j ACCEPT)
  if ! $SUDO iptables -C INPUT "${rule[@]}" 2>/dev/null; then
    local pos
    pos="$($SUDO iptables -L INPUT --line-numbers -n | awk '$2=="REJECT"{print $1; exit}')"
    if [ -n "$pos" ]; then $SUDO iptables -I INPUT "$pos" "${rule[@]}"; else $SUDO iptables -A INPUT "${rule[@]}"; fi
  fi
  # Persistência: só quando o arquivo tem a regra REJECT da Oracle (senão nada bloqueia).
  local line="-A INPUT ${rule[*]}"
  if [ -f /etc/iptables/rules.v4 ] && $SUDO grep -q '^-A INPUT -j REJECT' /etc/iptables/rules.v4 \
    && ! $SUDO grep -qF -- "$line" /etc/iptables/rules.v4; then
    $SUDO sed -i "0,/^-A INPUT -j REJECT/s//${line}\n-A INPUT -j REJECT/" /etc/iptables/rules.v4
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 443
if [ ! -f /etc/iptables/rules.v4 ] && ! command -v docker >/dev/null; then
  $SUDO netfilter-persistent save >/dev/null 2>&1 || true
fi
if command -v ufw >/dev/null && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow 80/tcp >/dev/null && $SUDO ufw allow 443/tcp >/dev/null && $SUDO ufw allow 443/udp >/dev/null
fi
ok "Portas 80/443 liberadas (lembre de liberar também na Security List da VCN)"

# ───────────────────────────── Docker
info "Docker Engine e Docker Compose"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  $SUDO install -m 0755 -d /etc/apt/keyrings
  $SUDO curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  $SUDO chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt_get update
  apt_get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Logs dos contêineres com tamanho limitado (o disco da VM é pequeno).
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }' | $SUDO tee /etc/docker/daemon.json >/dev/null
  $SUDO systemctl restart docker
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1
if [ -n "$SUDO" ] && ! id -nG "$USER" | grep -qw docker; then
  $SUDO usermod -aG docker "$USER"
  warn "Seu usuário entrou no grupo docker: saia e entre de novo no SSH para usar docker sem sudo."
fi
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="$SUDO docker"
ok "$(docker --version 2>/dev/null || $SUDO docker --version)"

# ───────────────────────────── Código
info "Código da loja em $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
  ok "Atualizado"
else
  [ -n "$REPO_URL" ] || REPO_URL="$(ask "URL do repositório Git (ex.: https://github.com/voce/tirvo-loja.git)")"
  [ -n "$REPO_URL" ] || die "Informe a URL do repositório: bash oracle-setup.sh <url-do-repositorio>"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  ok "Clonado"
fi
cd "$APP_DIR"
chmod +x deploy/*.sh docker/entrypoint.sh 2>/dev/null || true

# ───────────────────────────── .env
info "Arquivo de configuração (.env)"
get_env() { grep -E "^$1=" .env 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
set_env() {
  local key="$1" value="$2"
  if grep -qE "^$key=" .env; then
    local escaped
    escaped="$(printf '%s' "$value" | sed -e 's/[\/&|]/\\&/g')"
    sed -i "s|^$key=.*|$key=$escaped|" .env
  else
    printf '%s=%s\n' "$key" "$value" >>.env
  fi
}
created_env=0
if [ ! -f .env ]; then
  cp .env.example .env
  created_env=1
fi
chmod 600 .env

domain="${DOMAIN:-$(get_env DOMAIN)}"
if [ -z "$domain" ] || [ "$domain" = "localhost" ]; then
  domain="$(ask "Domínio da loja, sem https:// (ex.: loja.seudominio.com.br ou tirvo.duckdns.org)")"
fi
[ -n "$domain" ] || die "O domínio é obrigatório para o HTTPS. Rode de novo informando DOMAIN=seu.dominio"
domain="${domain#http://}"; domain="${domain#https://}"; domain="${domain%%/*}"
set_env DOMAIN "$domain"
set_env APP_URL "https://$domain"

admin_email="${ADMIN_EMAIL:-$(get_env ADMIN_EMAIL)}"
if [ -z "$admin_email" ] || { [ "$created_env" = 1 ] && [ -z "${ADMIN_EMAIL:-}" ]; }; then
  admin_email="$(ask "E-mail do administrador do painel" "${admin_email:-admin@$domain}")"
fi
set_env ADMIN_EMAIL "$admin_email"

generated_password=""
if [ -z "$(get_env ADMIN_PASSWORD)" ]; then
  generated_password="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16)"
  set_env ADMIN_PASSWORD "$generated_password"
fi
[ -n "$(get_env AUTH_SECRET)" ] || set_env AUTH_SECRET "$(openssl rand -hex 32)"
for key in MYSQL_PASSWORD MYSQL_ROOT_PASSWORD; do
  current="$(get_env "$key")"
  if [ -z "$current" ] || [[ "$current" == troque-esta-senha* ]]; then set_env "$key" "$(openssl rand -hex 20)"; fi
done
[ -n "$(get_env MYSQL_DATABASE)" ] || set_env MYSQL_DATABASE tirvo
[ -n "$(get_env MYSQL_USER)" ] || set_env MYSQL_USER tirvo
set_env DATABASE_URL "mysql://$(get_env MYSQL_USER):$(get_env MYSQL_PASSWORD)@mysql:3306/$(get_env MYSQL_DATABASE)"
set_env UPLOAD_DIR /app/data/uploads
ok ".env pronto (senhas geradas automaticamente)"

mkdir -p data/uploads backups
chmod 700 backups
[ -f backups/.gitignore ] || printf '*\n' >backups/.gitignore

# ───────────────────────────── Subindo
info "Construindo e iniciando os contêineres (a primeira vez leva de 5 a 15 minutos)"
$DOCKER compose up -d --build --remove-orphans
ok "Contêineres iniciados"

info "Aguardando o app ficar pronto"
for _ in $(seq 1 60); do
  status="$($DOCKER inspect --format '{{.State.Health.Status}}' "$($DOCKER compose ps -q app)" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  sleep 5
done
if [ "${status:-}" = "healthy" ]; then ok "App respondendo"; else warn "O app ainda não respondeu. Veja os logs: docker compose logs -f app"; fi

if [ ! -f data/.seed-done ]; then
  demo="${DEMO:-}"
  if [ -z "$demo" ]; then
    answer="$(ask "Carregar a loja de demonstração com produtos, banners e pedidos de exemplo? (s/N)" "n")"
    case "$answer" in s|S|sim|SIM|y|Y) demo=1 ;; *) demo=0 ;; esac
  fi
  if [ "$demo" = "1" ]; then
    info "Carregando a loja de demonstração"
    $DOCKER compose run --rm -T tools npm run db:seed
  else
    info "Primeira carga: administrador, configurações, páginas e categorias"
    $DOCKER compose run --rm -T tools npm run db:seed -- --minimal
  fi
  date -Iseconds >data/.seed-done
  ok "Banco preparado"
fi

# ───────────────────────────── Backup diário
info "Backup diário às 03:15"
cron_line="15 3 * * * cd $APP_DIR && ./deploy/backup.sh >> $APP_DIR/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' || true; echo "$cron_line" ) | crontab -
ok "Agendado (backups em $APP_DIR/backups, guardados por 14 dias)"

trap - ERR
cat <<EOF

────────────────────────────────────────────────────────────
 Tirvo no ar
────────────────────────────────────────────────────────────
  Loja:   https://$domain
  Painel: https://$domain/admin
  Login:  $admin_email
EOF
if [ -n "$generated_password" ]; then
  echo "  Senha:  $generated_password   (gerada agora, troque em Painel → Usuários)"
else
  echo "  Senha:  a definida em ADMIN_PASSWORD no arquivo .env"
fi
cat <<EOF

  Próximos passos no painel (Configurações):
  • Loja: WhatsApp que recebe os pedidos
  • Endereço e retirada: endereço da loja (o frete por km sai dele)
  • Frete e entrega: preço por km, frete grátis e raio de entrega
  • Pagamentos e Integrações: Pix, Stripe e provedor de mapas

  O certificado HTTPS sai em até 1 minuto depois que o domínio aponta para esta VM.
  Logs: cd $APP_DIR && docker compose logs -f app
EOF
