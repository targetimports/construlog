import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { alerta_id, emails_destinatarios = [] } = await req.json();

    const alerta = await base44.asServiceRole.entities.AlertaDesvio.read(alerta_id);
    if (!alerta) {
      return Response.json({ error: 'Alerta não encontrado' }, { status: 404 });
    }

    const notificacoes_enviadas = [];

    // Enviar email para cada destinatário
    for (const email of emails_destinatarios) {
      try {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: `[${alerta.nivel.toUpperCase()}] ${alerta.titulo}`,
          body: `
            <h2>${alerta.titulo}</h2>
            <p><strong>Tipo:</strong> ${alerta.tipo}</p>
            <p><strong>Descrição:</strong> ${alerta.descricao}</p>
            <p><strong>Data:</strong> ${new Date(alerta.data).toLocaleString('pt-BR')}</p>
            <p><a href="#">Visualizar no painel</a></p>
          `
        });

        notificacoes_enviadas.push({
          email,
          status: 'enviado',
          data: new Date().toISOString()
        });
      } catch (err) {
        notificacoes_enviadas.push({
          email,
          status: 'erro',
          erro: err.message
        });
      }
    }

    // Registrar tentativas de notificação
    await base44.asServiceRole.entities.AlertaDesvio.update(alerta_id, {
      notificacoes: notificacoes_enviadas,
      notificado_em: new Date().toISOString()
    });

    return Response.json({
      success: true,
      notificacoes_enviadas: notificacoes_enviadas.filter(n => n.status === 'enviado').length,
      detalhes: notificacoes_enviadas
    });
  } catch (error) {
    console.error('Erro ao enviar notificações:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});