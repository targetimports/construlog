import { store } from '../entityStore.js';
import calcBMv2 from './calcBMv2.js';

// Porte de retificarBM: marca a BM aprovada como RETIFICADA e cria uma nova BM
// RASCUNHO (mesmo número) copiando os itens, para correção. As BMs posteriores
// recalculam automaticamente o "anterior" (o calcBMv2 só soma BMs APROVADAS).
export default async function retificarBM({ body, user }) {
  const { bm_id, motivo_retificacao } = body || {};
  if (!bm_id) throw Object.assign(new Error('bm_id obrigatório'), { status: 400 });

  const bm = (await store.filter('BM', { id: bm_id }))[0];
  if (!bm) throw Object.assign(new Error('BM não encontrada'), { status: 404 });
  if (bm.status !== 'APROVADA') {
    throw Object.assign(new Error('Apenas BMs APROVADAS podem ser retificadas.'), { status: 400 });
  }

  await store.update('BM', bm_id, {
    status: 'RETIFICADA',
    motivo_retificacao: motivo_retificacao || null,
    data_retificacao: new Date().toISOString(),
    retificada_por: user?.email || null,
  });

  const hoje = new Date().toISOString().split('T')[0];
  const nova = await store.create('BM', {
    obra_id: bm.obra_id,
    contrato_versao_id: bm.contrato_versao_id,
    numero: bm.numero,
    status: 'RASCUNHO',
    data_inicio: bm.data_inicio || hoje,
    data_fim: bm.data_fim || hoje,
    retifica_bm_id: bm_id,
    motivo_retificacao: motivo_retificacao || null,
    total_contrato: bm.total_contrato || 0,
    total_anterior: 0,
    total_periodo: 0,
    total_acumulado: 0,
    percent_concluida: 0,
  }, user?.email || null);

  const itensOrig = (await store.filter('BMItem', { bm_id })) || [];
  for (const it of itensOrig) {
    await store.create('BMItem', {
      bm_id: nova.id,
      contrato_item_id: it.contrato_item_id,
      qtd_periodo_input: it.qtd_periodo_input ?? it.qtd_periodo_final ?? 0,
      override_manual: it.override_manual || false,
    }, user?.email || null);
  }

  await calcBMv2({ body: { bm_id: nova.id, persist: true, items_override: [] }, user }).catch(() => {});

  return { ok: true, numero_novo: bm.numero, bm_nova_id: nova.id };
}
