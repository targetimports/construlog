import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requisicao_id, etapa_numero, aprovado, comentario } = await req.json();

    // Buscar requisição
    const requisicao = await base44.entities.RequisicaoCompra.list('-updated_date', 1);
    const req_atual = requisicao.find(r => r.id === requisicao_id);

    if (!req_atual) {
      return Response.json({ error: 'Requisição não encontrada' }, { status: 404 });
    }

    // Atualizar workflow de aprovação
    const workflow = req_atual.workflow_aprovacao || { etapas: [] };
    const etapa = workflow.etapas[etapa_numero - 1];

    if (!etapa) {
      return Response.json({ error: 'Etapa não encontrada' }, { status: 404 });
    }

    // Encontrar aprovador atual
    const aprovadorIdx = etapa.aprovadores_pendentes.findIndex(
      a => a.user_email === user.email
    );

    if (aprovadorIdx === -1) {
      return Response.json({ error: 'Você não é um aprovador desta etapa' }, { status: 403 });
    }

    // Registrar aprovação/rejeição
    const aprovador = etapa.aprovadores_pendentes[aprovadorIdx];
    aprovador.aprovado = aprovado;
    aprovador.data_aprovacao = new Date().toISOString();
    aprovador.comentario = comentario;

    // Verificar se etapa foi concluída
    if (aprovado) {
      // Aprovação
      const todosAprovaram = etapa.requer_todos_aprovadores
        ? etapa.aprovadores_pendentes.every(a => a.aprovado)
        : etapa.aprovadores_pendentes.some(a => a.aprovado);

      if (todosAprovaram) {
        etapa.status = 'aprovada';

        // Verificar se todas as etapas foram aprovadas
        const todasAprovadas = workflow.etapas.every(e => e.status === 'aprovada');
        if (todasAprovadas) {
          req_atual.status_aprovacao = 'aprovada';
          req_atual.status = 'aberta';
          req_atual.data_aprovacao = new Date().toISOString();
          req_atual.aprovado_por = user.email;
        }
      }
    } else {
      // Rejeição
      etapa.status = 'rejeitada';
      etapa.motivo_rejeicao = comentario;
      req_atual.status_aprovacao = 'rejeitada';
      req_atual.status = 'cancelada';
    }

    // Atualizar requisição com novo workflow
    await base44.entities.RequisicaoCompra.update(requisicao_id, {
      workflow_aprovacao: workflow,
      status: req_atual.status,
      status_aprovacao: req_atual.status_aprovacao,
      data_aprovacao: req_atual.data_aprovacao,
      aprovado_por: req_atual.aprovado_por
    });

    // Criar registro de auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      entidade_tipo: 'RequisicaoCompra',
      entidade_id: requisicao_id,
      acao: aprovado ? 'aprovacao' : 'rejeicao',
      usuario_email: user.email,
      usuario_nome: user.full_name,
      dados_anteriores: { status_aprovacao: 'pendente' },
      dados_novos: { status_aprovacao: req_atual.status_aprovacao },
      descricao: `${aprovado ? 'Aprovação' : 'Rejeição'} na etapa ${etapa_numero}: ${comentario}`,
      timestamp: new Date().toISOString()
    });

    return Response.json({
      success: true,
      requisicao_id,
      novo_status: req_atual.status_aprovacao,
      mensagem: aprovado ? 'Requisição aprovada' : 'Requisição rejeitada'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});