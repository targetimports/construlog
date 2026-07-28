import { store } from '../entityStore.js';
import { custoMensalistaDaObra } from './maoObraCore.js';
import { custoFrotaDaObra } from './frotaCore.js';

// Calcula a DRE da obra (receitas, custos por categoria, lucro, margem) a partir
// dos dados reais e PERSISTE em DREObra (upsert). Alimenta o Dashboard Financeiro
// da obra e serve de base oficial para o Simulador.
//
// Receitas:
//   contratada = valor_contrato/orçado da obra
//   faturada   = medido acumulado das BMs aprovadas (ou obra.valor_realizado)
//   recebida   = recebimentos previstos com status RECEBIDO
// Custos realizados (LancamentoCustoObra por categoria); mão de obra cai para
//   ApontamentoMaoObra aprovado se não houver lançamento.

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export default async function calcularDREObra({ body, user }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });

  const obra = (await store.filter('Obra', { id: obra_id }))[0] || {};

  // ── Receitas ───────────────────────────────────────────────────────────
  const bms = (await store.filter('BM', { obra_id }).catch(() => []))
    .filter((b) => String(b.status).toUpperCase() === 'APROVADA');
  const medidoAcum = bms.reduce((mx, b) => Math.max(mx, num(b.total_acumulado)), 0);
  const receitaFaturada = num(obra.valor_realizado) || medidoAcum;

  const recs = await store.filter('RecebimentoPrevisto', { obra_id }).catch(() => []);
  const receitaRecebida = recs
    .filter((r) => r.status === 'RECEBIDO')
    .reduce((s, r) => s + num(r.valor_real ?? r.valor_previsto), 0);

  const receitaContratada = num(obra.valor_contrato) || num(obra.valor_orcado) || num(obra.total_orcamento);

  // ── Custos realizados ─────────────────────────────────────────────────
  // Fonte ÚNICA (igual getDreObra): LancamentoCustoObra (legado) + ContaFinanceira
  // pagar/PAGO (compras de material, serviços, equipamento, etc.). Antes esta função
  // lia só LancamentoCustoObra (vazio) → material aparecia 0, divergindo do relatório.
  let mat = 0, mo = 0, equip = 0, comb = 0, ind = 0;
  const addCusto = (categoria, valor) => {
    const v = num(valor);
    const c = String(categoria || '').toLowerCase();
    // Combustível ANTES de equipamento: custo de operação em linha própria, separado
    // do custo de posse da máquina (ver getDreObra.js).
    if (c.includes('combust') || c.includes('diesel') || c.includes('gasolina') || c.includes('arla')) comb += v;
    else if (c.includes('material')) mat += v;
    else if (c.includes('mao') || c.includes('mão')) mo += v;
    else if (c.includes('equip') || c.includes('locac') || c.includes('aluguel')) equip += v;
    else ind += v;
  };

  const lcs = await store.filter('LancamentoCustoObra', { obra_id }, '-data_lancamento', 5000).catch(() => []);
  for (const l of lcs) addCusto(l.categoria, l.valor);

  const cfPagas = (await store.filter('ContaFinanceira', { obra_id, tipo: 'pagar' }, '-data_pagamento', 20000).catch(() => []))
    .filter((c) => c.status === 'pago');
  for (const c of cfPagas) addCusto(c.categoria, c.valor);

  // Mão de obra: fallback para apontamentos aprovados só se nenhuma fonte trouxe MO.
  // (cobre o DIARISTA quando a conta a pagar da diária ainda não foi paga)
  if (mo === 0) {
    const aps = await store.filter('ApontamentoMaoObra', { obra_id, status: 'APROVADO' }, '-data', 5000).catch(() => []);
    mo = aps.reduce((s, a) => s + num(a.total ?? a.valor_diaria), 0);
  }
  // MENSALISTA: o custo dele está na folha (nível empresa) e nunca chegava na obra.
  // Soma a parte proporcional às horas apontadas no Ponto (horas × custo real da hora).
  // Aditivo e sem dobra: apontamento de mensalista não tem valor nem conta a pagar.
  mo += await custoMensalistaDaObra(obra_id).catch(() => 0);
  // FROTA: uso de ativo do grupo, rateado (não vira conta a pagar) — ver frotaCore.js.
  equip += await custoFrotaDaObra(obra_id).catch(() => 0);

  const custoTotal = r2(mat + mo + equip + comb + ind);
  const lucroBruto = r2(receitaFaturada - custoTotal);
  const margemPercentual = receitaFaturada > 0 ? r2((lucroBruto / receitaFaturada) * 100) : 0;

  const alertas = [];
  if (receitaFaturada > 0 && margemPercentual < 5) alertas.push(`⚠️ Margem baixa: ${margemPercentual.toFixed(1)}%`);
  if (receitaFaturada > 0 && custoTotal > receitaFaturada) alertas.push('⚠️ Custo realizado acima da receita faturada.');
  if (receitaFaturada === 0 && custoTotal === 0) alertas.push('Sem custos realizados nem medições aprovadas ainda.');

  const payload = {
    obra_id,
    receita_contratada: r2(receitaContratada),
    receita_faturada: r2(receitaFaturada),
    receita_recebida: r2(receitaRecebida),
    custo_materiais: r2(mat),
    custo_mao_obra: r2(mo),
    custo_equipamentos: r2(equip),
    custo_combustivel: r2(comb),
    custo_despesas_indiretas: r2(ind),
    custo_total: custoTotal,
    lucro_bruto: lucroBruto,
    margem_percentual: margemPercentual,
    consumo_vs_previsto: {},
    alertas,
    calculado_em: new Date().toISOString(),
  };

  // Upsert: atualiza o DREObra existente ou cria um novo (evita acúmulo).
  const existentes = await store.filter('DREObra', { obra_id }, '-created_date', 50).catch(() => []);
  if (existentes[0]) {
    await store.update('DREObra', existentes[0].id, payload).catch(() => {});
    return { ok: true, dre: { id: existentes[0].id, ...payload } };
  }
  const rec = await store.create('DREObra', payload, user?.email || null);
  return { ok: true, dre: { id: rec?.id, ...payload } };
}
