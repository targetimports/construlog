import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================
// IMPORTANTE: Este código consome o serviço WhatsApp externo
// O serviço deve estar rodando em VPS/Docker
// Ver: WHATSAPP_ARCHITECTURE.md e WHATSAPP_SERVICE_EXAMPLE.js
// ============================================

const WHATSAPP_SERVICE_URL = Deno.env.get('WHATSAPP_SERVICE_URL');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    // Verificar se serviço está configurado
    if (!WHATSAPP_SERVICE_URL) {
      return Response.json({
        error: 'Serviço WhatsApp não configurado',
        message: 'Configure a variável WHATSAPP_SERVICE_URL',
        details: 'O serviço WhatsApp (Baileys) deve estar rodando em VPS/Docker separado. Ver WHATSAPP_ARCHITECTURE.md'
      }, { status: 503 });
    }

    // ============ GERAR QR CODE ============
    if (action === 'generate_qr') {
      try {
        // Forçar reconexão no serviço
        const reconnectRes = await fetch(`${WHATSAPP_SERVICE_URL}/reconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!reconnectRes.ok) {
          throw new Error('Serviço WhatsApp offline');
        }

        // Aguardar QR ser gerado
        await new Promise(r => setTimeout(r, 2000));

        // Buscar QR do serviço
        const qrRes = await fetch(`${WHATSAPP_SERVICE_URL}/qr`);
        const data = await qrRes.json();

        if (data.connected) {
          // Já conectado
          const statusRes = await fetch(`${WHATSAPP_SERVICE_URL}/status`);
          const status = await statusRes.json();

          await base44.auth.updateMe({
            whatsapp_connected: true,
            whatsapp_phone: status.phone ? `+${status.phone}` : null
          });

          return Response.json({
            success: true,
            already_connected: true,
            phone: status.phone
          });
        }

        if (!data.qr_code) {
          throw new Error('QR Code não disponível');
        }

        return Response.json({
          success: true,
          qr_code: data.qr_code,
          message: 'Escaneie o QR Code com seu WhatsApp pessoal ou Business'
        });

      } catch (error) {
        return Response.json({ 
          error: 'Serviço WhatsApp não disponível',
          message: 'O serviço externo não está rodando. Deploy necessário.',
          details: error.message
        }, { status: 503 });
      }
    }

    // ============ GET STATUS ============
    if (action === 'get_status') {
      try {
        const response = await fetch(`${WHATSAPP_SERVICE_URL}/status`);
        const status = await response.json();

        // Atualizar banco se mudou
        if (status.connected !== user.whatsapp_connected) {
          await base44.auth.updateMe({
            whatsapp_connected: status.connected,
            whatsapp_phone: status.phone ? `+${status.phone}` : null
          });
        }

        return Response.json(status);
      } catch (error) {
        return Response.json({
          connected: false,
          error: 'Serviço offline',
          message: 'Serviço WhatsApp (Baileys) não está disponível'
        });
      }
    }

    // ============ DISCONNECT ============
    if (action === 'disconnect') {
      try {
        await fetch(`${WHATSAPP_SERVICE_URL}/disconnect`, {
          method: 'POST'
        });

        await base44.auth.updateMe({
          whatsapp_connected: false,
          whatsapp_phone: null
        });

        return Response.json({
          success: true,
          message: 'WhatsApp desconectado'
        });
      } catch (error) {
        return Response.json({ 
          error: error.message 
        }, { status: 500 });
      }
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});