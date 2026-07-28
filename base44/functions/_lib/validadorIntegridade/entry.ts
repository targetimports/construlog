/**
 * Validador Global de Integridade ERP
 * Garante que toda operação financeira/estoque/RH tenha obra_id e centro_custo_id
 */

export async function validarIntegridadeObraCentroCusto(base44, contexto) {
  const { 
    entidade, 
    obra_id, 
    centro_custo_id, 
    tipo_impacto,
    funcao,
    usuario_id,
    payload 
  } = contexto;

  const erros = [];

  // ========================================
  // VALIDAÇÕES POR TIPO DE IMPACTO
  // ========================================

  if (tipo_impacto === 'custo') {
    // Custos exigem obra_id E centro_custo_id
    if (!obra_id) {
      erros.push('obra_id é OBRIGATÓRIO para operações de custo');
    }
    if (!centro_custo_id) {
      erros.push('centro_custo_id é OBRIGATÓRIO para operações de custo');
    }
  }

  if (tipo_impacto === 'receita') {
    // Receitas exigem obra_id
    if (!obra_id) {
      erros.push('obra_id é OBRIGATÓRIO para operações de receita');
    }
  }

  if (tipo_impacto === 'movimentacao') {
    // Movimentações de saída exigem obra_id
    if (!obra_id) {
      erros.push('obra_id é OBRIGATÓRIO para movimentações de estoque');
    }
  }

  // ========================================
  // VALIDAR OBRA EXISTE E ESTÁ ATIVA
  // ========================================

  if (obra_id) {
    try {
      const obras = await base44.entities.Obra.filter({ id: obra_id });
      const obra = obras?.[0];
      
      if (!obra) {
        erros.push(`Obra ${obra_id} não encontrada`);
      } else if (obra.status === 'cancelada') {
        erros.push(`Obra ${obra_id} está CANCELADA. Não é possível registrar operações.`);
      }
    } catch (error) {
      erros.push(`Erro ao validar obra: ${error.message}`);
    }
  }

  // ========================================
  // SE HOUVER ERROS, BLOQUEAR E LOGAR
  // ========================================

  if (erros.length > 0) {
    const mensagemErro = erros.join('; ');
    
    // Registrar bloqueio
    try {
      await base44.asServiceRole.entities.LogIntegridadeSistema.create({
        entidade,
        funcao,
        tipo_impacto,
        obra_id: obra_id || null,
        centro_custo_id: centro_custo_id || null,
        payload: payload || {},
        erro: mensagemErro,
        usuario_id: usuario_id || 'desconhecido',
        data_bloqueio: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Erro ao registrar log de integridade:', logError);
    }

    // Lançar erro para bloquear operação
    throw new Error(`BLOQUEIO DE INTEGRIDADE: ${mensagemErro}`);
  }

  return { valido: true };
}