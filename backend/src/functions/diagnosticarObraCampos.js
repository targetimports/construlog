import { store } from '../entityStore.js';

// Diagnóstico pós-import: confere se a obra criada pelo OrçaFácil ficou com os
// campos/contagens esperados. O front só loga o resultado (prova de import), por
// isso é tolerante e nunca lança.
export default async function diagnosticarObraCampos({ body }) {
  const obraId = body?.obra_id || body?.obraId;
  if (!obraId) return { ok: false, motivo: 'obra_id não informado' };

  let obra = null;
  try {
    const [o] = await store.filter('Obra', { id: obraId }, null, 1);
    obra = o || null;
  } catch { /* ignore */ }
  if (!obra) return { ok: false, motivo: 'Obra não encontrada', obra_id: obraId };

  const [cronograma, planejado, statusRegs] = await Promise.all([
    store.filter('CronogramaItem', { obraId }).catch(() => []),
    store.filter('OrcamentoPlanejado', { obra_id: obraId }).catch(() => []),
    store.filter('OrcamentoConsolidacaoStatus', { obra_id: obraId }, '-created_date', 1).catch(() => []),
  ]);
  const consolidacao = statusRegs?.[0] || null;

  return {
    ok: true,
    obra_id: obraId,
    nome: obra.nome || null,
    campos: {
      total_orcamento: Number(obra.total_orcamento) || 0,
      tem_data_inicio: !!obra.data_inicio,
      tem_data_prevista_fim: !!obra.data_prevista_fim,
      cliente: obra.cliente_nome || obra.contratante_nome || obra.cliente_id || null,
    },
    contagens: {
      cronograma: (cronograma || []).length,
      orcamento_planejado: (planejado || []).length,
      itens_consolidados: consolidacao ? (Number(consolidacao.total_itens) || 0) : 0,
    },
    consolidacao: consolidacao ? { status: consolidacao.status, total_itens: Number(consolidacao.total_itens) || 0 } : null,
  };
}
