import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { instancia_id, status, comentario } = await req.json();

    if (!instancia_id || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Busca a instância do workflow
    const instancia = await base44.entities.WorkflowInstancia.read(instancia_id);
    if (!instancia) {
      return Response.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Busca a definição do workflow
    const workflowDef = await base44.entities.WorkflowDefinicao.read(instancia.workflow_definicao_id);

    // Registra a ação na auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      empresa_id: instancia.empresa_id,
      usuario_email: user.email,
      acao: status === 'aprovado' ? 'aprovar' : 'rejeitar',
      entidade: instancia.entidade_tipo,
      entidade_id: instancia.entidade_id,
      descricao: `${status === 'aprovado' ? 'Aprovou' : 'Rejeitou'} workflow na etapa ${instancia.etapa_atual}`,
      data_hora: new Date().toISOString()
    });

    // Calcula próximo status
    const progresso = instancia.progresso || [];
    const etapaAtual = workflowDef.etapas[instancia.etapa_atual];

    // Adiciona progresso da etapa atual
    progresso[instancia.etapa_atual] = {
      etapa: instancia.etapa_atual,
      status,
      usuario_email: user.email,
      comentario: comentario || '',
      data: new Date().toISOString()
    };

    let novoStatus = 'em_progresso';
    let novaEtapa = instancia.etapa_atual + 1;

    if (status === 'rejeitado') {
      novoStatus = 'rejeitado';
    } else if (novaEtapa >= workflowDef.etapas.length) {
      novoStatus = 'aprovado';
    }

    // Atualiza a instância
    const instanciaAtualizada = await base44.asServiceRole.entities.WorkflowInstancia.update(
      instancia_id,
      {
        progresso,
        etapa_atual: novaEtapa,
        status: novoStatus,
        data_conclusao: novoStatus !== 'em_progresso' ? new Date().toISOString() : null
      }
    );

    return Response.json({
      status: novoStatus,
      etapa: novaEtapa,
      instancia: instanciaAtualizada
    });
  } catch (error) {
    console.error('Erro ao processar workflow:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});