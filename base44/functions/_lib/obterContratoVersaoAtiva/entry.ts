/**
 * obterContratoVersaoAtiva(base44, obra_id)
 * 
 * Obtém a ContratoVersao ATIVA para uma obra.
 * Se não existir, retorna null.
 * 
 * BMs novas devem usar essa versão.
 */
export async function obterContratoVersaoAtiva(base44, obra_id) {
  try {
    const versoes = await base44.entities.ContratoVersao.filter({
      obra_id,
      status: 'ATIVA',
    });

    if (versoes && versoes.length > 0) {
      // Se houver mais de uma ATIVA (edge case), retorna a mais recente
      return versoes.sort(
        (a, b) => (b.numero_versao || 0) - (a.numero_versao || 0)
      )[0];
    }

    return null;
  } catch (error) {
    console.warn('[obterContratoVersaoAtiva] Erro:', error.message);
    return null;
  }
}