import { store } from '../entityStore.js';

// Simulador de Obra (plano §23): simula o impacto de aumentos de custo
// (material, mão de obra, consumo) e atraso de cronograma sobre a margem da obra.
//
// É autossuficiente: monta a DRE atual a partir dos dados reais da obra
// (custos lançados + receita medida/recebida); se ainda não há realizado,
// usa o orçamento como custo previsto e o contrato/orçado como receita.
//
// Retorno (compatível com o componente SimuladorObra):
//   { obra_id, parametros_simulados, cenario_atual, cenario_simulado, impactos, cenarios_criticos, dre_calculado }

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round((num(n)) * 100) / 100;

async function calcularDREAtual(obraId) {
  // 1) DREObra já calculada (se existir e tiver valores)
  const dres = await store.filter('DREObra', { obra_id: obraId }).catch(() => []);
  const d = dres[dres.length - 1];
  if (d && (num(d.receita_faturada) || num(d.custo_total))) {
    const custoTotal = num(d.custo_total) ||
      (num(d.custo_materiais) + num(d.custo_mao_obra) + num(d.custo_equipamentos) + num(d.custo_despesas_indiretas));
    const receita = num(d.receita_faturada);
    const lucro = num(d.lucro_bruto) || (receita - custoTotal);
    return {
      origem: 'dre',
      receita_faturada: receita,
      custo_materiais: num(d.custo_materiais),
      custo_mao_obra: num(d.custo_mao_obra),
      custo_equipamentos: num(d.custo_equipamentos),
      custo_despesas_indiretas: num(d.custo_despesas_indiretas),
      custo_total: custoTotal,
      lucro_bruto: lucro,
      margem_percentual: receita > 0 ? (lucro / receita) * 100 : 0,
    };
  }

  // 2) Calcular a partir de dados reais
  const obra = (await store.filter('Obra', { id: obraId }))[0] || {};

  // Custos realizados por categoria (LancamentoCustoObra)
  const lcs = await store.filter('LancamentoCustoObra', { obra_id: obraId }, '-data_lancamento', 5000).catch(() => []);
  let custoMat = 0, custoMo = 0, custoOutro = 0;
  for (const l of lcs) {
    const v = num(l.valor);
    const cat = String(l.categoria || '').toLowerCase();
    if (cat === 'material') custoMat += v;
    else if (cat === 'mao_de_obra') custoMo += v;
    else custoOutro += v;
  }
  let realizadoTotal = custoMat + custoMo + custoOutro;

  const recRecebidos = (await store.filter('RecebimentoPrevisto', { obra_id: obraId }).catch(() => []))
    .filter((r) => r.status === 'RECEBIDO')
    .reduce((s, r) => s + num(r.valor_real ?? r.valor_previsto), 0);
  const orcado = num(obra.valor_orcado) || num(obra.total_final_orcamento) || num(obra.total_orcamento);

  // Sem custo realizado ainda → usa o orçamento como custo previsto (split estimado).
  let origem = 'realizado';
  if (realizadoTotal <= 0 && orcado > 0) {
    origem = 'orcamento';
    custoMat = orcado * 0.6;   // estimativa: 60% material
    custoMo = orcado * 0.4;    // 40% mão de obra
    custoOutro = 0;
    realizadoTotal = orcado;
  }

  // Receita na MESMA base do custo (evita comparar receita parcial medida com
  // custo orçado total): planejado→contrato/orçado; realizado→medido/recebido.
  const receita = origem === 'orcamento'
    ? (num(obra.valor_contrato) || orcado)
    : (num(obra.valor_realizado) || recRecebidos || num(obra.valor_contrato) || orcado);

  const custoTotal = custoMat + custoMo + custoOutro;
  const lucro = receita - custoTotal;
  return {
    origem,
    receita_faturada: receita,
    custo_materiais: custoMat,
    custo_mao_obra: custoMo,
    custo_equipamentos: 0,
    custo_despesas_indiretas: custoOutro,
    custo_total: custoTotal,
    lucro_bruto: lucro,
    margem_percentual: receita > 0 ? (lucro / receita) * 100 : 0,
  };
}

export default async function simularObra({ body }) {
  const {
    obra_id,
    aumento_material_percentual = 0,
    aumento_mao_obra_percentual = 0,
    aumento_consumo_percentual = 0,
    atraso_cronograma_dias = 0,
  } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });

  const dre = await calcularDREAtual(obra_id);

  // Cenário simulado — custo nunca fica negativo (% de redução não passa de -100%).
  const custoMatSim = Math.max(0, dre.custo_materiais * (1 + num(aumento_material_percentual) / 100));
  const custoMoSim = Math.max(0, dre.custo_mao_obra * (1 + num(aumento_mao_obra_percentual) / 100));
  // Consumo extra incide sobre material
  const custoConsumoExtra = dre.custo_materiais * (num(aumento_consumo_percentual) / 100);
  const custoTotalSim = Math.max(0, custoMatSim + custoMoSim + dre.custo_equipamentos + dre.custo_despesas_indiretas + custoConsumoExtra);

  // Atraso de cronograma penaliza a receita (aprox. 0,1% por dia)
  const impactoAtraso = num(atraso_cronograma_dias) > 0 ? dre.receita_faturada * 0.001 * num(atraso_cronograma_dias) : 0;
  const receitaSim = dre.receita_faturada - impactoAtraso;

  const lucroSim = receitaSim - custoTotalSim;
  const margemSim = receitaSim > 0 ? (lucroSim / receitaSim) * 100 : 0;

  const impactoTotal = lucroSim - dre.lucro_bruto;
  const impactoPercentual = dre.lucro_bruto > 0 ? (impactoTotal / dre.lucro_bruto) * 100 : 0;

  const cenariosCriticos = [];
  if (margemSim < 0) cenariosCriticos.push('Prejuízo: a margem simulada ficou negativa.');
  if (Math.abs(impactoPercentual) > 20) cenariosCriticos.push(`Impacto severo: ${impactoPercentual.toFixed(1)}% no lucro.`);
  if (dre.origem === 'orcamento') cenariosCriticos.push('Sem custo realizado ainda — base estimada pelo orçamento (material 60% / mão de obra 40%).');

  return {
    obra_id,
    parametros_simulados: {
      aumento_material_percentual: num(aumento_material_percentual),
      aumento_mao_obra_percentual: num(aumento_mao_obra_percentual),
      aumento_consumo_percentual: num(aumento_consumo_percentual),
      atraso_cronograma_dias: num(atraso_cronograma_dias),
    },
    cenario_atual: {
      receita_faturada: r2(dre.receita_faturada),
      custo_total: r2(dre.custo_total),
      lucro_bruto: r2(dre.lucro_bruto),
      margem_percentual: r2(dre.margem_percentual),
    },
    cenario_simulado: {
      receita_faturada: r2(receitaSim),
      custo_materiais: r2(custoMatSim),
      custo_mao_obra: r2(custoMoSim),
      custo_total: r2(custoTotalSim),
      lucro_bruto: r2(lucroSim),
      margem_percentual: r2(margemSim),
    },
    impactos: {
      material: r2(custoMatSim - dre.custo_materiais),
      mao_obra: r2(custoMoSim - dre.custo_mao_obra),
      consumo: r2(custoConsumoExtra),
      atraso_cronograma: r2(impactoAtraso),
      total_lucro: r2(impactoTotal),
      total_percentual: r2(impactoPercentual),
    },
    cenarios_criticos: cenariosCriticos,
    dre_calculado: {
      receita_faturada: r2(dre.receita_faturada),
      custo_materiais: r2(dre.custo_materiais),
      custo_mao_obra: r2(dre.custo_mao_obra),
      custo_total: r2(dre.custo_total),
      lucro_bruto: r2(dre.lucro_bruto),
      margem_percentual: r2(dre.margem_percentual),
      origem: dre.origem,
    },
  };
}
