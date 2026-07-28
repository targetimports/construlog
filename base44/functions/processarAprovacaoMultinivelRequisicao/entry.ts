import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { aprovacao_pendente_id, acao, comentario } = payload;

    // Buscar aprovação pendente
    const aprovacao = await base44.asServiceRole.entities.AprovacaoPendente.filter({
      id: aprovacao_pendente_id
    }).then(r => r[0]);

    if (!aprovacao) {
      return Response.json({ error: 'Aprovação não encontrada' }, { status: 404 });
    }

    // Encontrar aprovador atual
    const aprovadorIdx = aprovacao.aprovadores_pendentes.findIndex(
      a => a.user_email === user.email
    );

    if (aprovadorIdx === -1) {
      return Response.json({ 
        error: 'Você não está autorizado a aprovar esta requisição' 
      }, { status: 403 });
    }

    // Atualizar status do aprovador
    const aprovadores = [...aprovacao.aprovadores_pendentes];
    if (acao === 'aprovar') {
      aprovadores[aprovadorIdx].aprovado = true;
      aprovadores[aprovadorIdx].data_aprovacao = new Date().toISOString();
      aprovadores[aprovadorIdx].comentario = comentario || '';
    } else if (acao === 'rejeitar') {
      // Se rejeitar, toda a aprovação é rejeitada
      await base44.asServiceRole.entities.AprovacaoPendente.update(aprovacao_pendente_id, {
        status: 'rejeitada',
        data_conclusao: new Date().toISOString()
      });

      // Atualizar requisição
      const requisicao = await base44.asServiceRole.entities.RequisicaoCompra.filter({
        id: aprovacao.entidade_id
      }).then(r => r[0]);

      if (requisicao) {
        await base44.asServiceRole.entities.RequisicaoCompra.update(aprovacao.entidade_id, {
          status: 'cancelada',
          status_aprovacao: 'rejeitada',
          motivo_rejeicao: comentario || 'Rejeitado na etapa: ' + aprovacao.alcada_nome,
          data_aprovacao: new Date().toISOString()
        });

        // Notificar solicitante
        if (requisicao.solicitante_email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: requisicao.solicitante_email,
            subject: `Requisição Rejeitada: ${requisicao.titulo}`,
            body: `
Sua requisição foi rejeitada por ${user.full_name} na etapa de ${aprovacao.alcada_nome}.

Motivo: ${comentario || 'Não informado'}

Entre em contato para maiores detalhes.

---
Germanos Construlog
            `
          });
        }
      }

      return Response.json({ 
        success: true, 
        message: 'Requisição rejeitada' 
      });
    }

    // Verificar se etapa está completa
    const todosAprovaram = aprovadores.every(a => a.aprovado);
    const algumAprovaram = aprovadores.some(a => a.aprovado);

    let novoStatus = aprovacao.status;
    if (aprovacao.requer_todos_aprovadores) {
      novoStatus = todosAprovaram ? 'aprovada' : 'pendente';
    } else {
      novoStatus = algumAprovaram ? 'aprovada' : 'pendente';
    }

    // Atualizar aprovação pendente
    await base44.asServiceRole.entities.AprovacaoPendente.update(aprovacao_pendente_id, {
      aprovadores_pendentes: aprovadores,
      status: novoStatus,
      data_conclusao: novoStatus === 'aprovada' ? new Date().toISOString() : null
    });

    // Se etapa foi aprovada, passar para próxima
    if (novoStatus === 'aprovada') {
      const workflow = await base44.asServiceRole.entities.WorkflowAprovacao.filter({
        id: aprovacao.workflow_id
      }).then(r => r[0]);

      const proximaEtapa = workflow.etapas.find(e => e.numero === aprovacao.etapa_numero + 1);

      if (proximaEtapa) {
        // Criar próxima aprovação
        const alcada = await base44.asServiceRole.entities.AlcadaAprovacao.filter({
          id: proximaEtapa.alcada_id
        }).then(r => r[0]);

        const proxAprovadores = alcada.aprovadores?.map(a => ({
          user_email: a.user_email,
          nome: a.nome,
          aprovado: false
        })) || [];

        if (proxAprovadores.length > 0) {
          await base44.asServiceRole.entities.AprovacaoPendente.create({
            entidade_tipo: aprovacao.entidade_tipo,
            entidade_id: aprovacao.entidade_id,
            workflow_id: aprovacao.workflow_id,
            etapa_numero: proximaEtapa.numero,
            alcada_id: proximaEtapa.alcada_id,
            alcada_nome: alcada.nome,
            aprovadores_pendentes: proxAprovadores,
            status: 'pendente',
            requer_todos_aprovadores: proximaEtapa.requer_todos || alcada.requer_todos_aprovadores,
            data_criacao: new Date().toISOString()
          });
        }
      } else {
        // Última etapa aprovada - atualizar requisição como aprovada
        await base44.asServiceRole.entities.RequisicaoCompra.update(aprovacao.entidade_id, {
          status: 'aberta',
          status_aprovacao: 'aprovada',
          data_aprovacao: new Date().toISOString()
        });
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Aprovação processada com sucesso',
      novo_status: novoStatus
    });
  } catch (error) {
    console.error('Erro ao processar aprovação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});