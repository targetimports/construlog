import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Registra ações do assistente com detalhes completos
 * Para auditoria, debug e estatísticas
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { actionDraft, result, status, error } = await req.json();

    const logEntry = {
      usuario_solicitante: user.email,
      usuario_perfil: user.perfil_sistema || user.cargo,
      comando_original: actionDraft.comando_original,
      acao_realizada: actionDraft.acao,
      entidade_afetada: actionDraft.entidade_alvo,
      
      // Dados da ação
      dados_entrada: actionDraft.dados,
      dados_saida: result,
      
      // Status e erro
      status: status || 'executado',
      erro_mensagem: error?.message || null,
      erro_stack: error?.stack || null,
      
      // IDs relacionados
      registro_id: result?.registro_id || result?.id || null,
      obra_id: actionDraft.dados.obra_id || null,
      
      // Valores para desfazer
      valor_anterior: actionDraft.dados.valor_anterior || null,
      valor_novo: result,
      
      // Metadados
      requer_aprovacao: actionDraft.requires_approval,
      aprovado: !actionDraft.requires_approval,
      aprovado_por: !actionDraft.requires_approval ? user.email : null,
      
      data_hora: new Date().toISOString(),
      duracao_ms: result?.duracao_ms || null
    };

    const log = await base44.asServiceRole.entities.LogAcaoIA.create(logEntry);

    return Response.json({
      success: true,
      log_id: log.id
    });

  } catch (error) {
    console.error('Erro ao registrar log:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});