/**
 * Sistema de Auditoria Total
 * Registra automaticamente toda criação, alteração e exclusão
 */

export async function registrarAuditoria(base44, contexto) {
  try {
    const {
      entidade,
      entidade_id,
      operacao,
      dados_antes,
      dados_depois,
      usuario_id,
      obra_id,
      origem_funcao
    } = contexto;

    if (!entidade || !entidade_id || !operacao || !usuario_id || !origem_funcao) {
      console.error('Auditoria: campos obrigatórios faltando', contexto);
      return;
    }

    // Calcular campos alterados (para UPDATE)
    let camposAlterados = [];
    if (operacao === 'atualizar' && dados_antes && dados_depois) {
      camposAlterados = Object.keys(dados_depois).filter(key => {
        const antes = JSON.stringify(dados_antes[key]);
        const depois = JSON.stringify(dados_depois[key]);
        return antes !== depois;
      });
    }

    await base44.asServiceRole.entities.LogAuditoriaSistema.create({
      entidade,
      entidade_id,
      operacao,
      dados_antes: dados_antes || null,
      dados_depois: dados_depois || null,
      usuario_id,
      obra_id: obra_id || null,
      data_hora: new Date().toISOString(),
      origem_funcao,
      campos_alterados: camposAlterados
    });

  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
    // Não bloquear operação principal por falha na auditoria
  }
}

/**
 * Buscar histórico completo de uma entidade
 */
export async function getHistoricoEntidade(base44, entidade, entidade_id) {
  try {
    const logs = await base44.entities.LogAuditoriaSistema.filter({
      entidade,
      entidade_id
    });

    // Ordenar por data decrescente
    return logs.sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }
}