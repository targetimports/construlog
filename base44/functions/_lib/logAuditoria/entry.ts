/**
 * Utilitário Central de Auditoria
 * 
 * Registra todas as ações críticas no sistema com trilha completa
 * Falha "soft" - nunca quebra o fluxo principal
 */

export async function logAuditoria(base44, {
  entidade_tipo,
  entidade_id,
  acao, // CREATE|UPDATE|DELETE|APPROVE|RECEIVE|BAIXA|AUTO|IMPORT|EXPORT
  resumo,
  dados_anteriores = null,
  dados_novos = null,
  user_email = null,
  role = null,
  origem = 'api', // ui|api|automacao|import
  detalhes = null,
  modulo = null
}) {
  try {
    // Validações mínimas
    if (!entidade_tipo || !acao) {
      console.error('[logAuditoria] Campos obrigatórios ausentes:', { entidade_tipo, acao });
      return;
    }

    // Criar log
    await base44.asServiceRole.entities.LogAuditoria.create({
      entidade: entidade_tipo,
      entidade_id: entidade_id || null,
      acao,
      user_email: user_email || 'sistema',
      modulo: modulo || entidade_tipo.toLowerCase(),
      dados_anteriores,
      dados_novos,
      detalhes: resumo || detalhes || `${acao} em ${entidade_tipo}`,
      sucesso: true,
      ip: null,
      user_agent: null
    });

    console.log(`[AUDITORIA] ${acao} - ${entidade_tipo} - ${entidade_id || 'N/A'} - por ${user_email || 'sistema'}`);
  } catch (error) {
    // Falha soft - apenas loga erro mas não quebra o fluxo
    console.error('[ERRO logAuditoria] Falha ao registrar log:', error.message);
  }
}

// Helper: preparar dados para log (remove campos desnecessários)
export function prepararDadosLog(dados, camposPermitidos = []) {
  if (!dados) return null;
  
  if (camposPermitidos.length === 0) {
    // Se não especificou campos, retorna tudo
    return dados;
  }
  
  // Filtra apenas campos permitidos
  const resultado = {};
  for (const campo of camposPermitidos) {
    if (dados[campo] !== undefined) {
      resultado[campo] = dados[campo];
    }
  }
  return resultado;
}