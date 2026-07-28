import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Wrapper centralizado para UPDATE de Colaborador
 * Garante que automação (remoção de equipes) roda em qualquer via (UI, API, importação)
 * Valida que status !== 'ativo' → dispara remoção automática de equipes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { colaborador_id, dados_atualizacao } = body;

    if (!colaborador_id) {
      return Response.json({ 
        ok: false, 
        error: 'Missing colaborador_id' 
      }, { status: 400 });
    }

    // 1. Buscar colaborador atual para saber o status antigo
    const colaboradorAtual = await base44.entities.Colaborador.filter({ id: colaborador_id });
    if (!colaboradorAtual || colaboradorAtual.length === 0) {
      return Response.json({ 
        ok: false, 
        error: 'Colaborador not found' 
      }, { status: 404 });
    }

    const statusAntigo = colaboradorAtual[0].status;
    const statusNovo = dados_atualizacao.status || statusAntigo;

    // 2. Atualizar colaborador
    const colaboradorAtualizado = await base44.entities.Colaborador.update(
      colaborador_id,
      dados_atualizacao
    );

    // 3. Se status mudou para != 'ativo', dispara automação
    if (statusNovo !== 'ativo' && statusAntigo !== statusNovo) {
      console.log(`[AUTO] Status ${statusAntigo} → ${statusNovo}. Removendo ${colaborador_id} de equipes...`);
      
      // Chamar função de automação
      const autoResult = await base44.asServiceRole.functions.invoke(
        'automacaoRemocaoEquipes',
        { colaborador_id, status_novo: statusNovo, disparado_por: 'updateColaboradorComAutomacao' }
      );

      return Response.json({
        ok: true,
        colaborador: colaboradorAtualizado,
        automacao_disparada: true,
        automacao_resultado: autoResult?.data || {}
      });
    }

    return Response.json({
      ok: true,
      colaborador: colaboradorAtualizado,
      automacao_disparada: false
    });

  } catch (error) {
    console.error('[ERROR] updateColaboradorComAutomacao:', error);
    return Response.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    }, { status: 500 });
  }
});