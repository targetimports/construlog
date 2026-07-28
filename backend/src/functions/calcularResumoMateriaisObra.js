import { store } from '../entityStore.js';

// Resumo do planejamento de materiais da obra (planejado x recebido) para o
// selo de status no topo. "Recebido" é calculado AO VIVO pelas movimentações de
// estoque da obra (ENTRADA + TRANSFERENCIA), igual ao comparativo Planejado×Real,
// com fallback nos campos do próprio registro quando não há material_id/movimento.

const num = (v) => Number(v) || 0;

export default async function calcularResumoMateriaisObra({ body }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });

  const [necessidades, movs] = await Promise.all([
    store.filter('NecessidadeMaterialObra', { obra_id }).catch(() => []),
    store.filter('EstoqueMovimentacao', { obra_id }, '-created_date', 20000).catch(() => []),
  ]);

  // Quanto de cada material chegou na obra (entrada direta + transferência).
  const recebidoPorMat = {};
  for (const m of movs || []) {
    const k = m.material_id;
    if (!k) continue;
    const t = String(m.tipo || '').toUpperCase();
    if (t === 'ENTRADA' || t === 'TRANSFERENCIA') {
      recebidoPorMat[k] = (recebidoPorMat[k] || 0) + num(m.quantidade);
    }
  }

  const total = (necessidades || []).length;
  let ok = 0, falta = 0, naoMapeados = 0;
  for (const n of necessidades || []) {
    if (!n.insumo_id && !n.material_id) { naoMapeados++; continue; }
    const previsto = num(n.quantidade_prevista);
    const atendidoMov = n.material_id ? num(recebidoPorMat[n.material_id]) : 0;
    const atendidoCampos = num(n.quantidade_comprada) + num(n.quantidade_transferida) + num(n.quantidade_em_estoque);
    const atendido = Math.max(atendidoMov, atendidoCampos);
    if (atendido >= previsto) ok++; else falta++;
  }

  let status_geral = 'OK';
  let badge = 'Materiais OK';
  if (total === 0) {
    status_geral = 'SEM_PLANEJAMENTO';
    badge = 'Sem planejamento de materiais';
  } else if (falta > 0) {
    status_geral = 'EM_FALTA';
    badge = `${falta} material(is) em falta`;
  } else if (naoMapeados > 0) {
    status_geral = 'PENDENTE_MAPEAMENTO';
    badge = `${naoMapeados} não mapeado(s)`;
  }

  return {
    status_geral,
    badge,
    total_planejados: total,
    materiais_ok: ok,
    materiais_em_falta: falta,
    materiais_nao_mapeados: naoMapeados,
  };
}
