/**
 * Função auxiliar que busca a BM a considerar para somatório
 * Se há retificação aprovada, usa essa; caso contrário, usa a original
 */
export async function getBMParaCalculo(base44, bm_id) {
  const bm = await base44.entities.BM.list();
  const bmOriginal = bm.find(b => b.id === bm_id);

  if (!bmOriginal) {
    return null;
  }

  // Se essa BM é original e foi retificada, buscar a retificação aprovada
  if (bmOriginal.retificada_por_id) {
    const bmRetificada = bm.find(b => b.id === bmOriginal.retificada_por_id);
    if (bmRetificada && bmRetificada.status === 'APROVADA') {
      return bmRetificada;
    }
  }

  // Se essa é uma retificação, usar ela se aprovada
  if (bmOriginal.status === 'RETIFICADA' && bmOriginal.retifica_bm_id) {
    return bmOriginal;
  }

  // Caso contrário, usar a BM original se aprovada
  if (bmOriginal.status === 'APROVADA') {
    return bmOriginal;
  }

  return null;
}

/**
 * Busca o total_anterior considerando retificações
 * Para cálculo de uma BM, busca a última BM anterior aprovada (considerando retificações)
 */
export async function calcTotalAnteriorComRetificacao(base44, obra_id, contrato_versao_id, numero_atual) {
  const bms = await base44.entities.BM.filter({
    obra_id,
    contrato_versao_id,
    status: ['APROVADA', 'RETIFICADA'],
  });

  // Filtrar BMs anteriores (numero < numero_atual)
  const bmsAnteriores = bms.filter(b => b.numero < numero_atual);

  if (!bmsAnteriores.length) {
    return 0;
  }

  // Ordenar por numero descendente
  bmsAnteriores.sort((a, b) => b.numero - a.numero);

  // Pegar a BM mais recente e considerar retificação se existir
  const bmMaisRecente = bmsAnteriores[0];
  const bmParaCalculo = await getBMParaCalculo(base44, bmMaisRecente.id);

  return bmParaCalculo?.total_acumulado || 0;
}