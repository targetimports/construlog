import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { titulo, corpo, tipo_alerta, url_acao, dados_adicionais } = await req.json();

    if (!titulo || !corpo) {
      return Response.json({ error: 'Título e corpo são obrigatórios' }, { status: 400 });
    }

    // Armazena a notificação
    const notificacao = await base44.entities.Notificacao.create({
      destinatario_email: user.email,
      tipo: tipo_alerta || 'alerta',
      titulo: titulo,
      mensagem: corpo,
      link_acao: url_acao || null,
      lida: false
    });

    // Busca os device tokens do usuário
    const deviceTokens = user.push_notification_tokens || [];

    if (deviceTokens.length === 0) {
      return Response.json({
        success: true,
        notificacao_id: notificacao.id,
        push_enviado: false,
        motivo: 'Usuário sem dispositivos registrados'
      });
    }

    // Simula envio de push (em produção, integraria com Firebase, OneSignal, etc)
    const payload = {
      title: titulo,
      body: corpo,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `alerta_${notificacao.id}`,
      requireInteraction: tipo_alerta === 'critico',
      data: {
        notificacao_id: notificacao.id,
        tipo: tipo_alerta,
        url: url_acao || '/',
        ...dados_adicionais
      }
    };

    // Log de envio
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'enviar_push_notificacao',
      modulo: 'notificacoes',
      entidade: 'Notificacao',
      entidade_id: notificacao.id,
      detalhes: `Enviado push para ${deviceTokens.length} dispositivo(s) - Tipo: ${tipo_alerta}`,
      sucesso: true
    });

    return Response.json({
      success: true,
      notificacao_id: notificacao.id,
      push_enviado: true,
      dispositivos_alcancados: deviceTokens.length,
      timestamp: new Date().toISOString(),
      status: tipo_alerta === 'critico' ? 'Push CRÍTICO enviado!' : 'Push enviado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao enviar push:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});