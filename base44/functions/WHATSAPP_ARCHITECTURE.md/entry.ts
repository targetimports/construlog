# Arquitetura WhatsApp - Solução Correta

## ⚠️ PROBLEMA IDENTIFICADO

Baileys **NÃO FUNCIONA** em ambiente serverless porque:
- Cada execução da function é efêmera
- O filesystem /tmp é limpo após execução
- WebSocket desconecta quando a function termina
- QR code é invalidado imediatamente

## ✅ SOLUÇÃO CORRETA

### 1. Serviço WhatsApp Persistente (Node.js)

Hospedar em **VPS/Docker/PM2** separado:

```
whatsapp-service/
├── index.js          # Servidor Express
├── whatsapp.js       # Lógica Baileys
├── package.json
└── auth_info/        # Sessões persistentes
```

### 2. Endpoints HTTP do Serviço

```
GET  /qr              # Retorna QR code base64
GET  /status          # Status da conexão
POST /send-message    # Envia mensagem
POST /disconnect      # Desconecta
```

### 3. Function Base44

Apenas **consome** os endpoints do serviço:
- Não instancia Baileys
- Faz HTTP requests
- Salva status no banco

## 📦 IMPLEMENTAÇÃO

Ver arquivo: `WHATSAPP_SERVICE_EXAMPLE.js` para código completo do serviço.

## 🚀 DEPLOY

### Opção 1: VPS com PM2
```bash
npm install
pm2 start index.js --name whatsapp-service
pm2 save
```

### Opção 2: Docker
```bash
docker build -t whatsapp-service .
docker run -d -p 3000:3000 -v ./auth_info:/app/auth_info whatsapp-service
```

### Opção 3: Railway / Render
- Deploy como serviço Node.js
- Configurar volume persistente para `auth_info/`

## 🔒 SEGURANÇA

- Adicionar autenticação (API key)
- HTTPS obrigatório
- Whitelist de IPs da Base44