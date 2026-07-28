import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { podeAcessarObra } from '../escopoObra.js';
import { custoMensalistaDaObra } from './maoObraCore.js';
import { custoFrotaDaObra } from './frotaCore.js';

// DRE da obra (período opcional): receita prevista/realizada, custos por grupo,
// margem e breakdown por categoria.
// Custos = LancamentoCustoObra (legado) + ContaFinanceira pagar/pago (lançamentos,
// importação de planilha, contas a pagar liquidadas) + fallback mão de obra.
// Receita = BM aprovada / valor_realizado da obra (não soma ContaFinanceira a receber
// para não duplicar a receita das medições, que já geram conta a receber).

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

const grupoDe = (cat) => {
  const c = String(cat || '').toLowerCase();
  // COMBUSTÍVEL em linha própria (cliente, 2026-07-20): custo de OPERAÇÃO, separado do
  // custo de POSSE da máquina (tarifa de uso, que fica em 'equipamento'). Preço de
  // combustível oscila e o consumo varia com a frente de serviço — misturar os dois
  // esconde desvio de diesel. Vem ANTES de 'equip' para não ser capturado por ele.
  if (c.includes('combust') || c.includes('diesel') || c.includes('gasolina') || c.includes('arla')) return 'combustivel';
  if (c.includes('mao') || c.includes('mão')) return 'mao_obra';
  if (c.includes('material')) return 'material';
  if (c.includes('equip') || c.includes('locac') || c.includes('aluguel')) return 'equipamento';
  if (c.includes('transporte') || c.includes('frete')) return 'transporte';
  if (c.includes('imposto')) return 'imposto';
  return 'outros';
};

export default async function getDreObra({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const { obra_id, de, ate } = body || {};
  if (!obra_id) return { error: 'obra_id é obrigatório' };

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) return { error: 'Obra não encontrada' };
  if (!(await podeAcessarObra(user, obra_id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const dentro = (d) => (!de || (d && d >= de)) && (!ate || (d && d <= ate));

  let lcs = await store.filter('LancamentoCustoObra', { obra_id }, '-data_lancamento', 20000).catch(() => []);
  lcs = lcs.filter((l) => dentro(String(l.data_lancamento || '').slice(0, 10)));

  const custosGrupo = {};
  const porCategoria = {};
  const addCusto = (categoria, valor) => {
    const g = grupoDe(categoria);
    custosGrupo[g] = r2((custosGrupo[g] || 0) + num(valor));
    const cat = String(categoria || 'outros');
    porCategoria[cat] = r2((porCategoria[cat] || 0) + num(valor));
  };

  for (const l of lcs) addCusto(l.categoria, l.valor);

  // Custos de ContaFinanceira a pagar liquidadas (lançamentos/importação/contas pagas).
  const cfPagas = (await store.filter('ContaFinanceira', { obra_id, tipo: 'pagar' }, '-data_pagamento', 20000).catch(() => []))
    .filter((c) => c.status === 'pago' && dentro(String(c.data_pagamento || c.data_vencimento || '').slice(0, 10)));
  for (const c of cfPagas) addCusto(c.categoria, c.valor);

  // Mão de obra: fallback para apontamentos aprovados se nenhuma fonte trouxe MO.
  // (cobre o DIARISTA quando a conta a pagar da diária ainda não foi paga)
  if (!custosGrupo['mao_obra']) {
    const aps = (await store.filter('ApontamentoMaoObra', { obra_id, status: 'APROVADO' }, '-data', 5000).catch(() => []))
      .filter((a) => dentro(String(a.data || '').slice(0, 10)));
    const mo = r2(aps.reduce((s, a) => s + num(a.total ?? a.valor_diaria), 0));
    if (mo > 0) { custosGrupo['mao_obra'] = mo; porCategoria['mao_de_obra'] = mo; }
  }
  // MENSALISTA: custo da folha (nível empresa) rateado para a obra pelas horas do
  // Ponto (horas × custo real da hora). Aditivo — apontamento de mensalista não tem
  // valor nem conta a pagar, então não há dupla contagem.
  const moMensalista = await custoMensalistaDaObra(obra_id, { de, ate }).catch(() => 0);
  if (moMensalista > 0) {
    custosGrupo['mao_obra'] = r2((custosGrupo['mao_obra'] || 0) + moMensalista);
    porCategoria['mao_de_obra'] = r2((porCategoria['mao_de_obra'] || 0) + moMensalista);
  }
  // FROTA: uso de veículo/máquina do grupo. Rateio gerencial — não existe conta a
  // pagar correspondente, então é aditivo e não duplica (ver frotaCore.js).
  const frota = await custoFrotaDaObra(obra_id, { de, ate }).catch(() => 0);
  if (frota > 0) {
    custosGrupo['equipamento'] = r2((custosGrupo['equipamento'] || 0) + frota);
    porCategoria['frota_equipamentos'] = r2((porCategoria['frota_equipamentos'] || 0) + frota);
  }

  const total_custos = r2(Object.values(custosGrupo).reduce((s, v) => s + v, 0));
  const custos = { ...custosGrupo, total_custos };

  const bms = (await store.filter('BM', { obra_id }).catch(() => [])).filter((b) => String(b.status).toUpperCase() === 'APROVADA');
  const medido = bms.reduce((mx, b) => Math.max(mx, num(b.total_acumulado)), 0);
  const receita_realizada = r2(num(obra.valor_realizado) || medido);
  const receita_prevista = r2(num(obra.valor_contrato) || num(obra.valor_orcado) || num(obra.total_orcamento));

  const margem_bruta = r2(receita_realizada - total_custos);
  const margem_percentual = receita_realizada > 0 ? r2((margem_bruta / receita_realizada) * 100) : 0;

  const breakdown_por_categoria = Object.entries(porCategoria)
    .map(([cat, total]) => ({ categoria_nome: cat.replace(/_/g, ' '), grupo: grupoDe(cat), total: r2(total) }))
    .sort((a, b) => b.total - a.total);

  const warnings = [];
  if (receita_realizada === 0 && total_custos === 0) warnings.push('Sem custos nem receitas no período/obra selecionados.');
  if (receita_realizada > 0 && margem_percentual < 5) warnings.push(`Margem baixa: ${margem_percentual.toFixed(1)}%`);
  if (lcs.length > 0 && cfPagas.length > 0) warnings.push('Custos vêm de duas fontes (lançamentos de custo + contas a pagar pagas) — verifique se não há duplicidade.');

  return { receita_prevista, receita_realizada, custos, margem_bruta, margem_percentual, breakdown_por_categoria, warnings };
}
