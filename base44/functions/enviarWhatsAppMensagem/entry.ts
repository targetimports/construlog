import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { logAuditoria } from './_lib/logAuditoria.js';

const WHATSAPP_SERVICE_URL = Deno.env.get('WHATSAPP_SERVICE_URL');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { numero, mensagem, titulo, tipo } = await req.json();

    if (!numero || !mensagem) {
      return Response.json({ error: 'Número e mensagem são obrigatórios' }, { status: 400 });
    }

    // Verificar se serviço está configurado
    if (!WHATSAPP_SERVICE_URL) {
      return Response.json({
        error: 'Serviço WhatsApp não configurado',
        message: 'WhatsApp aguardando infraestrutura externa (Baileys em VPS/Docker)'
      }, { status: 503 });
    }

    try {
      const response = await fetch(`${WHATSAPP_SERVICE_URL}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          numero: numero.replace(/\D/g, ''),
          mensagem: mensagem
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar mensagem');
      }

      console.log(`✅ WhatsApp enviado para ${numero}`);

      // Registrar notificação
      try {
        await base44.entities.Notificacao.create({
          destinatario_email: user.email,
          tipo: tipo || 'mensagem',
          titulo: titulo || 'WhatsApp',
          mensagem: mensagem,
          lida: false
        });
      } catch (notifErr) {
        console.warn('⚠️ Erro ao registrar notificação:', notifErr.message);
      }

      // Log de auditoria
      await logAuditoria(base44, {
        entidade_tipo: 'WhatsApp',
        entidade_id: result.messageId || 'unknown',
        acao: 'ENVIAR_MENSAGEM',
        resumo: `Mensagem WhatsApp enviada para ${numero}`,
        dados_novos: { numero, titulo, tipo },
        user_email: user.email,
        origem: 'api',
        modulo: 'comunicacao'
      });

      return Response.json({
        success: true,
        provider: 'WhatsApp Service (HTTP)',
        messageId: result.messageId
      });

    } catch (error) {
      console.error('❌ Erro ao enviar WhatsApp:', error);
      return Response.json({
        error: 'Serviço WhatsApp offline',
        message: 'O serviço Baileys não está disponível',
        details: error.message
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});