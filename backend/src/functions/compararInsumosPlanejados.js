import { store } from '../entityStore.js';

// Insumos Planejados (plano §18): compara, por material, o PREVISTO
// (NecessidadeMaterialObra) com o realizado vindo das movimentações de estoque
// (EstoqueMovimentacao): comprado (ENTRADA), transferido (TRANSFERENCIA) e
// consumido (SAIDA). Gera alertas de "previsto não comprado", "consumo acima do
// previsto" e "compra acima do previsto", além de listar consumos sem planejamento.

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function compararInsumosPlanejados({ body }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });

  const [necessidades, movs, materiais] = await Promise.all([
    store.filter('NecessidadeMaterialObra', { obra_id }, '-created_date', 5000).catch(() => []),
    store.filter('EstoqueMovimentacao', { obra_id }, '-created_date', 20000).catch(() => []),
    store.filter('Material', {}, '-created_date', 10000).catch(() => []),
  ]);
  const matMap = Object.fromEntries((materiais || []).map((m) => [m.id, m]));
  const nomeMat = (id) => matMap[id]?.nome || matMap[id]?.descricao || null;

  // Agrega movimentações por material_id.
  const aggMov = {};
  for (const m of movs || []) {
    const k = m.material_id;
    if (!k) continue;
    if (!aggMov[k]) aggMov[k] = { comprado: 0, transferido: 0, consumido: 0 };
    const q = num(m.quantidade);
    const t = String(m.tipo || '').toUpperCase();
    if (t === 'ENTRADA') aggMov[k].comprado += q;
    else if (t === 'TRANSFERENCIA') aggMov[k].transferido += q;
    else if (t === 'SAIDA') aggMov[k].consumido += q;
  }

  // Agrupa necessidades por chave (material_id || insumo_id).
  const grp = {};
  for (const n of necessidades || []) {
    const key = n.material_id || n.insumo_id || n.id;
    if (!grp[key]) {
      grp[key] = {
        key,
        material_id: n.material_id || null,
        insumo_id: n.insumo_id || null,
        descricao: n.descricao || nomeMat(n.material_id) || '',
        unidade: n.unidade || matMap[n.material_id]?.unidade || '',
        previsto: 0,
        valor_previsto: 0,
        ids: [],
      };
    }
    grp[key].previsto += num(n.quantidade_prevista);
    grp[key].valor_previsto += num(n.valor_total_previsto);
    grp[key].ids.push(n.id);
  }

  const itens = Object.values(grp).map((g) => {
    const mv = (g.material_id && aggMov[g.material_id]) || { comprado: 0, transferido: 0, consumido: 0 };
    const comprado = r2(mv.comprado);
    const transferido = r2(mv.transferido);
    const consumido = r2(mv.consumido);
    const disponivel = r2(comprado + transferido); // material que chegou à obra
    const saldo = r2(g.previsto - consumido);
    const alertas = [];
    if (g.previsto > 0 && disponivel <= 0) alertas.push('previsto_nao_comprado');
    if (g.previsto > 0 && consumido > g.previsto) alertas.push('consumo_acima_previsto');
    if (g.previsto > 0 && disponivel > g.previsto * 1.1) alertas.push('compra_acima_previsto');
    return {
      ...g,
      previsto: r2(g.previsto),
      valor_previsto: r2(g.valor_previsto),
      comprado, transferido, consumido, disponivel, saldo, alertas,
    };
  }).sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

  // Materiais movimentados sem planejamento.
  const planejados = new Set(Object.values(grp).map((g) => g.material_id).filter(Boolean));
  const semPlano = Object.entries(aggMov)
    .filter(([matId]) => !planejados.has(matId))
    .map(([matId, mv]) => ({
      material_id: matId,
      descricao: nomeMat(matId) || `Material ${String(matId).slice(0, 8)}`,
      comprado: r2(mv.comprado),
      transferido: r2(mv.transferido),
      consumido: r2(mv.consumido),
    }))
    .filter((x) => x.comprado || x.transferido || x.consumido);

  const resumo = {
    total: itens.length,
    nao_comprados: itens.filter((i) => i.alertas.includes('previsto_nao_comprado')).length,
    consumo_acima: itens.filter((i) => i.alertas.includes('consumo_acima_previsto')).length,
    compra_acima: itens.filter((i) => i.alertas.includes('compra_acima_previsto')).length,
    sem_planejamento: semPlano.length,
  };

  return { itens, sem_planejamento: semPlano, resumo };
}
