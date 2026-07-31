import { store } from '../entityStore.js';
import { custoRealDaObra } from './custoServicoCore.js';

// Calcula a DRE da obra (receitas, custos por categoria, lucro, margem) a partir
// dos dados reais e PERSISTE em DREObra (upsert). Alimenta o Dashboard Financeiro
// da obra e serve de base oficial para o Simulador.
//
// Receitas:
//   contratada = valor_contrato/orçado da obra
//   faturada   = medido acumulado das BMs aprovadas (ou obra.valor_realizado)
//   recebida   = recebimentos previstos com status RECEBIDO
// Custos realizados: vêm inteiros de custoRealDaObra (conta a pagar paga,
//   lançamento de custo, mão de obra do Ponto e frota devolvida), classificados
//   por categoria. Mesma fonte do relatório de desvio, por construção.

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
  // FONTE ÚNICA: custoRealDaObra (custoServicoCore.js), a mesma que o controle
  // de desvio usa. Antes esta função repetia a conta por fora, e as duas
  // divergiam sem que ninguém percebesse — a DRE contava mensalista e frota, o
  // relatório de desvio não, e a obra parecia mais barata de um lado que do
  // outro. Uma conta só, dois leitores.
  //
  // A classificação por categoria é a mesma de antes (combustível em linha
  // própria, separado do custo de posse da máquina); mudou apenas quem calcula.
  const real = await custoRealDaObra(obra_id);
  const cat = real.por_categoria || {};
  const mat = num(cat.material);
  const mo = num(cat.mao_de_obra);
  const equip = num(cat.equipamento);
  const comb = num(cat.combustivel);
  const ind = num(cat.indireto);

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
