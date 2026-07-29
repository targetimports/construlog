#!/usr/bin/env bash
# INSTALADOR DO CONSTRULOG.
#
#   ./instalar.sh sistema.empresa.com.br
#
# Sobe a instalação completa (banco + backend + frontend), publica no domínio e
# emite o certificado. Roda em Ubuntu com Docker e nginx já instalados.
#
# Seguro de repetir: se o .env já existir, ele é preservado — as senhas geradas
# na primeira vez continuam valendo, e rodar de novo vira só "rebuildar".

set -euo pipefail

DOMINIO="${1:-}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ"

vermelho() { printf '\033[31m%s\033[0m\n' "$1"; }
verde()    { printf '\033[32m%s\033[0m\n' "$1"; }
passo()    { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if [ -z "$DOMINIO" ]; then
  vermelho "Uso: ./instalar.sh dominio-do-cliente.com.br"
  exit 1
fi

# ─── Pré-requisitos ──────────────────────────────────────────────────────
passo "Conferindo o servidor"
for cmd in docker nginx openssl; do
  command -v "$cmd" >/dev/null 2>&1 || { vermelho "Falta o comando: $cmd"; exit 1; }
done
docker compose version >/dev/null 2>&1 || { vermelho "Falta o plugin 'docker compose'."; exit 1; }
verde "    ok"

# O domínio precisa apontar para esta máquina ANTES do certificado — senão o
# certbot falha e a instalação fica pela metade.
passo "Conferindo o DNS de $DOMINIO"
IP_SERVIDOR="$(curl -s --max-time 10 https://api.ipify.org || true)"
IP_DOMINIO="$(getent hosts "$DOMINIO" | awk '{print $1}' | head -1 || true)"
if [ -n "$IP_SERVIDOR" ] && [ -n "$IP_DOMINIO" ] && [ "$IP_SERVIDOR" != "$IP_DOMINIO" ]; then
  vermelho "    $DOMINIO aponta para $IP_DOMINIO, mas este servidor é $IP_SERVIDOR."
  vermelho "    Acerte o DNS antes de continuar (o certificado vai falhar assim)."
  read -r -p "    Continuar mesmo assim (sem HTTPS)? [s/N] " r
  [ "${r,,}" = "s" ] || exit 1
  SEM_TLS=1
else
  verde "    ok ($IP_DOMINIO)"
fi

# ─── .env ────────────────────────────────────────────────────────────────
passo "Preparando o .env"
if [ -f .env ]; then
  verde "    .env já existe — mantido (as senhas atuais continuam valendo)."
else
  PG_PWD="$(openssl rand -hex 24)"
  JWT="$(openssl rand -hex 32)"
  ADM_PWD="$(openssl rand -base64 15 | tr -d '/+=' | cut -c1-14)"
  read -r -p "    E-mail do administrador: " ADM_EMAIL
  ADM_EMAIL="${ADM_EMAIL:-admin@$DOMINIO}"

  cat > .env <<EOF
NODE_ENV=production
POSTGRES_USER=construlog
POSTGRES_PASSWORD=${PG_PWD}
POSTGRES_DB=construlog
DATABASE_URL=postgres://construlog:${PG_PWD}@db:5432/construlog
JWT_SECRET=${JWT}

SEED_ADMIN_EMAIL=${ADM_EMAIL}
SEED_ADMIN_NOME=Administrador
SEED_ADMIN_SENHA=${ADM_PWD}

# Instalação de cliente NUNCA cria dados fictícios.
SEED_DEMO=false

APP_PUBLIC_URL=https://${DOMINIO}
PORTA_FRONTEND=${PORTA_FRONTEND:-8960}
PORTA_BACKEND=${PORTA_BACKEND:-8970}

# Licenciamento — preencher com os dados que o fornecedor gerou.
BACKOFFICE_URL=
BACKOFFICE_API_KEY=
EOF
  chmod 600 .env
  verde "    criado"
  CREDENCIAIS="e-mail: ${ADM_EMAIL} | senha: ${ADM_PWD}"
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a
PORTA_FRONTEND="${PORTA_FRONTEND:-8960}"
PORTA_BACKEND="${PORTA_BACKEND:-8970}"

# Porta ocupada por outro sistema = container que não sobe, com erro obscuro.
passo "Conferindo as portas $PORTA_FRONTEND e $PORTA_BACKEND"
for p in "$PORTA_FRONTEND" "$PORTA_BACKEND"; do
  if ss -tln 2>/dev/null | grep -q ":$p "; then
    vermelho "    A porta $p já está em uso. Ajuste PORTA_FRONTEND/PORTA_BACKEND no .env."
    exit 1
  fi
done
verde "    livres"

cat > docker-compose.override.yml <<EOF
# Portas desta instalação. Só em 127.0.0.1 — quem expõe para fora é o nginx.
services:
  frontend:
    ports:
      - "127.0.0.1:${PORTA_FRONTEND}:80"
  backend:
    ports:
      - "127.0.0.1:${PORTA_BACKEND}:3000"
EOF

# ─── Containers ──────────────────────────────────────────────────────────
passo "Construindo as imagens (demora alguns minutos)"
docker compose build

passo "Subindo os containers"
docker compose up -d

# ─── nginx ───────────────────────────────────────────────────────────────
passo "Publicando em $DOMINIO"
NOME_SITE="construlog-$(echo "$DOMINIO" | tr '.' '-')"
cat > "/etc/nginx/sites-available/$NOME_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMINIO} www.${DOMINIO};

    location /api/ {
        proxy_pass http://127.0.0.1:${PORTA_FRONTEND};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:${PORTA_FRONTEND};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 50m;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;
}
EOF
ln -sfn "/etc/nginx/sites-available/$NOME_SITE" "/etc/nginx/sites-enabled/$NOME_SITE"
nginx -t && systemctl reload nginx
verde "    nginx ok"

if [ -z "${SEM_TLS:-}" ] && command -v certbot >/dev/null 2>&1; then
  passo "Emitindo o certificado HTTPS"
  certbot --nginx -d "$DOMINIO" -d "www.$DOMINIO" \
    --non-interactive --agree-tos --redirect \
    -m "${SEED_ADMIN_EMAIL:-admin@$DOMINIO}" || \
    vermelho "    Certificado falhou — o site segue em HTTP. Rode o certbot depois."
fi

# ─── Fim ─────────────────────────────────────────────────────────────────
passo "Conferindo"
sleep 10
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORTA_FRONTEND}/" || echo 000)"
[ "$CODIGO" = "200" ] && verde "    frontend respondendo (200)" || vermelho "    frontend respondeu $CODIGO — veja: docker compose logs frontend"

echo
verde "════════════════════════════════════════════════════════════"
verde " Instalação concluída: https://${DOMINIO}"
[ -n "${CREDENCIAIS:-}" ] && verde " Primeiro acesso → ${CREDENCIAIS}"
verde ""
verde " Entre com esse usuário: o sistema vai pedir os dados da"
verde " empresa e montar tudo (caixa, estoque, empresas do grupo)."
verde "════════════════════════════════════════════════════════════"
