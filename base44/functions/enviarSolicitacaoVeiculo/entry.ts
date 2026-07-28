import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { solicitacao_id } = await req.json();

    if (!solicitacao_id) {
      return Response.json({ error: 'solicitacao_id obrigatório' }, { status: 400 });
    }

    const solicitacoes = await base44.entities.SolicitacaoVeiculo.list();
    const solicitacao = solicitacoes.find(s => s.id === solicitacao_id);

    if (!solicitacao) {
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    // Validar se é o solicitante
    if (solicitacao.solicitante_user_id !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Validar campos obrigatórios
    if (!solicitacao.finalidade || !solicitacao.data_saida_prevista) {
      return Response.json({ error: 'Preencha finalidade e data de saída' }, { status: 400 });
    }

    // Atualizar status
    const atualizada = await base44.entities.SolicitacaoVeiculo.update(
      solicitacao_id,
      { status: 'enviada' }
    );

    // Buscar admins da empresa para notificar
    const todosUsuarios = await base44.asServiceRole.entities.User.list();
    const admins = todosUsuarios.filter(u => u.role === 'admin');

    const dataSaida = solicitacao.data_saida_prevista
      ? new Date(solicitacao.data_saida_prevista).toLocaleString('pt-BR')
      : '-';

    const titulo = `Nova Solicitação de Veículo: ${solicitacao.numero || solicitacao_id}`;
    const mensagem = `${user.full_name || user.email} solicitou um veículo.\n\nFinalidade: ${solicitacao.finalidade}\nUrgência: ${solicitacao.urgencia || '-'}\nSaída Prevista: ${dataSaida}\nOrigem: ${solicitacao.origem || '-'}\nDestino: ${solicitacao.destino || '-'}`;

    // Notificar cada admin: e-mail + notificação no sistema
    for (const admin of admins) {
      // Notificação no sistema
      await base44.asServiceRole.entities.Notificacao.create({
        destinatario_email: admin.email,
        tipo: 'alerta',
        titulo,
        mensagem,
        lida: false,
        link_acao: '/SolicitacoesVeiculos',
        usuario_relacionado_email: user.email,
        usuario_relacionado_nome: user.full_name || user.email
      }).catch(e => console.warn('Notificação sistema falhou:', e.message));

      // E-mail
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: titulo,
        body: `
          <h2>Nova Solicitação de Veículo</h2>
          <p><strong>Número:</strong> ${solicitacao.numero || solicitacao_id}</p>
          <p><strong>Solicitante:</strong> ${user.full_name || user.email}</p>
          <p><strong>Finalidade:</strong> ${solicitacao.finalidade}</p>
          <p><strong>Urgência:</strong> ${solicitacao.urgencia || '-'}</p>
          <p><strong>Tipo de Vínculo:</strong> ${solicitacao.tipo_vinculo || '-'}</p>
          <p><strong>Saída Prevista:</strong> ${dataSaida}</p>
          <p><strong>Origem:</strong> ${solicitacao.origem || '-'}</p>
          <p><strong>Destino:</strong> ${solicitacao.destino || '-'}</p>
          <br/>
          <p>Acesse o sistema para aprovar ou rejeitar esta solicitação.</p>
        `
      }).catch(e => console.warn('E-mail falhou para', admin.email, ':', e.message));
    }

    return Response.json({
      success: true,
      solicitacao: atualizada,
      admins_notificados: admins.length
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});