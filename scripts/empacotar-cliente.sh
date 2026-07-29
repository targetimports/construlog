#!/usr/bin/env bash
# EMPACOTAR O ERP PARA UM CLIENTE.
#
# Gera o pacote de instalação a partir deste repositório, removendo o back-office
# (o painel de clientes/cobranças, que é do fornecedor). O cliente não pode
# receber código que enxerga a régua comercial dos outros clientes.
#
#   ./scripts/empacotar-cliente.sh [destino]
#
# Saída: uma pasta pronta para copiar para a VPS do cliente + um .tgz.
#
# Por que empacotar em vez de manter dois repositórios: enquanto o produto ainda
# muda toda semana, dividir agora dobraria o trabalho de manter os dois em dia.
# Este script mantém a separação REAL na entrega, com um lugar só para corrigir.
# Quando o ritmo baixar, a divisão em dois repositórios é o passo natural.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${1:-$RAIZ/../construlog-cliente}"

echo "==> Empacotando de: $RAIZ"
echo "==> Para:           $DESTINO"

rm -rf "$DESTINO"
mkdir -p "$DESTINO"

# 1) Cópia do projeto, sem o que não vai para o cliente.
tar -cf - \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude=backend/node_modules \
  --exclude=backend/uploads \
  --exclude=logs \
  --exclude=.env \
  --exclude=backend/.env \
  --exclude=docker-compose.override.yml \
  -C "$RAIZ" . | tar -xf - -C "$DESTINO"

cd "$DESTINO"

# 2) Fora o back-office: telas, layout, API de integração e o módulo comercial.
rm -f  src/pages/Painel*.jsx
rm -rf src/components/painel
rm -f  src/lib/planos.js
rm -f  backend/src/integracao.js
rm -rf backend/src/pagamentos
rm -f  backend/src/functions/testarInstanciaCliente.js
rm -f  scripts/empacotar-cliente.sh

# 3) Entidades comerciais saem da lista (são do painel, não do ERP).
node - <<'JS'
const fs = require('fs');
const p = 'backend/src/entities.list.json';
const comerciais = ['ClienteSaaS', 'Assinatura', 'Cobranca', 'InstanciaCliente', 'ChaveApi', 'LogIntegracao'];
const lista = JSON.parse(fs.readFileSync(p, 'utf8'));
const limpa = lista.filter((e) => !comerciais.includes(e));
fs.writeFileSync(p, JSON.stringify(limpa, null, 2) + '\n');
console.log(`    entidades: ${lista.length} -> ${limpa.length} (removidas ${lista.length - limpa.length} comerciais)`);
JS

# 4) O ERP nasce LIGADO no pacote do cliente (aqui ele fica desligado porque
#    este repositório roda como back-office).
cat > src/config/modulos.js <<'EOF'
// Módulos desta instalação.
//
// No pacote do cliente o ERP é o sistema — nasce ligado. A landing pública ("/")
// pode ser desligada quando o cliente já tem site próprio: aí "/" vai direto
// para o login, em vez de servir uma página de apresentação.

export const ERP_ATIVO = true;
export const PRODUTO = 'Construlog';
export const LANDING_PUBLICA = true;
export const ROTA_POS_LOGIN = '/Dashboard';
EOF

echo "==> Recortando os blocos do back-office no App.jsx..."
node - <<'JS'
const fs = require('fs');
const alvo = 'src/App.jsx';
// Recorte por MARCADOR, não por regex em nome de arquivo: um dia o ERP pode ter
// uma tela chamada "Painel alguma coisa" e o filtro esperto levaria ela junto.
const linhas = fs.readFileSync(alvo, 'utf8').split('\n');
const saida = [];
let dentro = false;
let blocos = 0;
for (const l of linhas) {
  if (l.includes('<<< BACKOFFICE')) { dentro = true; blocos++; continue; }
  if (l.includes('>>> BACKOFFICE')) { dentro = false; continue; }
  if (!dentro) saida.push(l);
}
if (dentro) { console.error('    ERRO: marcador de fim ausente no App.jsx'); process.exit(1); }
if (blocos === 0) { console.error('    ERRO: nenhum bloco BACKOFFICE encontrado — o recorte falhou'); process.exit(1); }
fs.writeFileSync(alvo, saida.join('\n'));
console.log(`    App.jsx: ${blocos} bloco(s) do back-office removidos`);
JS

# Rede de segurança: se sobrou qualquer referência ao painel, o pacote não
# compila na VPS do cliente — melhor falhar aqui do que lá.
if grep -rn "components/painel\|pages/Painel" src/ 2>/dev/null; then
  echo "    ERRO: ainda há referências ao back-office no pacote (acima)."
  exit 1
fi

# 5) Guia de instalação junto do pacote — quem instala não deve precisar de mim
#    nem de um chat aberto do lado.
cat > INSTALAR.md <<'EOF'
# Instalar o Construlog

Pacote do sistema pronto para subir no servidor do cliente.

## Antes de começar

No servidor (Ubuntu):

- **Docker** com o plugin `compose` — `docker compose version` tem que responder
- **nginx** e **certbot** (`apt install nginx certbot python3-certbot-nginx`)
- O **domínio já apontando** para o IP do servidor (registro A). Sem isso o
  certificado HTTPS falha e o site fica só em HTTP.

## Instalação

```bash
tar -xzf construlog-cliente.tgz      # ou: unzip construlog-cliente.zip
cd construlog-cliente
chmod +x instalar.sh                 # necessário se veio do .zip
./instalar.sh sistema.cliente.com.br
```

O instalador pergunta o e-mail do administrador, gera as senhas, sobe os
containers, publica no nginx e emite o certificado. Ao final ele mostra o
**usuário e a senha do primeiro acesso** — anote, a senha não é exibida de novo.

## Primeiro acesso

Abra o domínio, entre com esse usuário e preencha a **configuração inicial**:
nome da empresa, CNPJ, contato e as empresas do grupo (se houver mais de uma).
O sistema cria a estrutura (caixa, estoque central) já com os dados do cliente.

O sistema **não vem com dados de exemplo**: nada de empresa fictícia ou usuário
de teste. O que aparecer lá dentro é o que o cliente cadastrar.

## Licenciamento (opcional)

Para acompanhar a instalação pelo painel do fornecedor — e poder bloquear o
acesso em caso de inadimplência — acrescente ao `.env` o bloco fornecido e
reinicie o backend:

```bash
docker compose up -d backend
```

Sem esse bloco, a instalação funciona normalmente e não reporta nada.

## Comandos do dia a dia

```bash
docker compose ps                  # o que está rodando
docker compose logs -f backend     # acompanhar o backend
docker compose restart backend     # reiniciar
docker compose up -d --build       # aplicar uma atualização do código
```

## Backup

O banco vive no volume `construlog_dbdata`. Configure uma rotina de backup antes
de colocar dados reais — há um exemplo em `scripts/backup-db.sh`.
EOF
echo "    INSTALAR.md gerado"

# 6) Pacote fechado.
cd "$(dirname "$DESTINO")"
NOME="$(basename "$DESTINO")"
tar -czf "$NOME.tgz" "$NOME"

echo
echo "==> Pronto:"
echo "    pasta:  $DESTINO"
echo "    pacote: $(cd "$(dirname "$DESTINO")" && pwd)/$NOME.tgz"
echo
echo "    Próximo passo na VPS do cliente:"
echo "      tar -xzf $NOME.tgz && cd $NOME && ./instalar.sh dominio-do-cliente.com.br"
