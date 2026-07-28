/**
 * AUDITORIA: registra before/after de operações críticas
 * 
 * Uso:
 *   await registrarAuditoria(base44, {
 *     entidade: 'OrdemCompra',
 *     entidadeId: oc.id,
 *     operacao: 'criar',
 *     obraId: oc.obra_id,
 *     usuarioId: user.email,
 *     funcao: 'criarOrdemCompra',
 *     beforeData: null,
 *     afterData: oc
 *   });
 */

async function registrarAuditoria(base44, config) {
  try {
    const {
      entidade,
      entidadeId,
      operacao,
      obraId,
      usuarioId,
      funcao,
      beforeData = null,
      afterData = null,
      ipOrigem = null,
      detalhes = null
    } = config;
    
    // Detectar campos alterados (para updates)
    let camposAlterados = [];
    if (beforeData && afterData) {
      camposAlterados = Object.keys(afterData)
        .filter(key => {
          const antes = JSON.stringify(beforeData[key]);
          const depois = JSON.stringify(afterData[key]);
          return antes !== depois;
        });
    }
    
    // Criar log de auditoria
    const logAuditoria = {
      entidade,
      entidade_id: entidadeId,
      operacao,
      dados_antes: beforeData ? JSON.stringify(beforeData) : null,
      dados_depois: afterData ? JSON.stringify(afterData) : null,
      usuario_id: usuarioId,
      obra_id: obraId || null,
      data_hora: new Date().toISOString(),
      origem_funcao: funcao,
      ip_origem: ipOrigem,
      campos_alterados: camposAlterados,
      detalhes: detalhes ? JSON.stringify(detalhes) : null
    };
    
    // Salvar em LogAuditoriaSistema
    await base44.asServiceRole.entities.LogAuditoriaSistema.create(logAuditoria);
    
    return { ok: true, auditado: true };
  } catch (error) {
    // Log de erro, mas não falhar a operação principal
    console.error('[auditoria] Erro ao registrar:', error.message);
    return { ok: false, auditado: false, erro: error.message };
  }
}

/**
 * Wrapper seguro para operações com auditoria automática
 */
async function comAuditoria(base44, config, operacao) {
  try {
    const resultado = await operacao();
    
    // Registrar sucesso
    await registrarAuditoria(base44, {
      ...config,
      afterData: resultado
    });
    
    return resultado;
  } catch (error) {
    // Registrar erro
    await registrarAuditoria(base44, {
      ...config,
      detalhes: { erro: error.message }
    });
    
    throw error;
  }
}

/**
 * Lista de auditoria para uma entidade
 */
async function obterAuditoriaEntidade(base44, entidade, entidadeId, limite = 50) {
  try {
    const logs = await base44.asServiceRole.entities.LogAuditoriaSistema.filter(
      { entidade, entidade_id: entidadeId },
      '-data_hora',
      limite
    );
    return logs;
  } catch (error) {
    console.error('[auditoria] Erro ao buscar:', error.message);
    return [];
  }
}

export {
  registrarAuditoria,
  comAuditoria,
  obterAuditoriaEntidade
};