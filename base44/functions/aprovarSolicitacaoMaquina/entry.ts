import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('[aprovarSolicitacaoMaquina] Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar permissão (admin ou engenheiro/gestor)
    const perfisAutorizados = ['admin', 'diretor', 'engenheiro_coordenador', 'engenheiro_obra'];
    if (user.role !== 'admin' && !perfisAutorizados.includes(user.cargo)) {
      console.error('[aprovarSolicitacaoMaquina] Forbidden:', user.cargo);
      return Response.json({ 
        error: 'Sem permissão para aprovar solicitações' 
      }, { status: 403 });
    }

    const { solicitacao_id, aprovar, motivo_recusa } = await req.json();

    console.log('[aprovarSolicitacaoMaquina] Action:', { solicitacao_id, aprovar, motivo_recusa });

    if (!solicitacao_id) {
      return Response.json({ error: 'solicitacao_id obrigatório' }, { status: 400 });
    }

    const solicitacao = await base44.asServiceRole.entities.SolicitacaoMaquina.get(solicitacao_id);
    if (!solicitacao) {
      console.error('[aprovarSolicitacaoMaquina] Not found:', solicitacao_id);
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    if (solicitacao.status !== 'enviada' && solicitacao.status !== 'rascunho') {
      console.error('[aprovarSolicitacaoMaquina] Invalid status:', solicitacao.status);
      return Response.json({ 
        error: `Solicitação já foi processada (status: ${solicitacao.status})` 
      }, { status: 400 });
    }

    // Atualizar status
    const novoStatus = aprovar ? 'aprovada' : 'recusada';
    const atualizado = await base44.asServiceRole.entities.SolicitacaoMaquina.update(solicitacao_id, {
      status: novoStatus,
      motivo_recusa: aprovar ? null : (motivo_recusa || 'Sem motivo especificado')
    });

    console.log('[aprovarSolicitacaoMaquina] Updated to:', novoStatus);

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: aprovar ? 'aprovar' : 'recusar',
      modulo: 'solicitacao_maquinas',
      entidade: 'SolicitacaoMaquina',
      entidade_id: solicitacao_id,
      dados_anteriores: solicitacao,
      dados_novos: atualizado,
      detalhes: aprovar 
        ? `Aprovada solicitação de ${solicitacao.tipo_maquina}`
        : `Recusada solicitação de ${solicitacao.tipo_maquina}: ${motivo_recusa}`,
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      solicitacao: atualizado,
      mensagem: aprovar ? 'Solicitação aprovada' : 'Solicitação recusada'
    });
  } catch (error) {
    console.error('[aprovarSolicitacaoMaquina] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});