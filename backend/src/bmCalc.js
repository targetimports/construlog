import { store } from './entityStore.js';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Núcleo de cálculo do Boletim de Medição (BM). Compartilhado por calcBM,
// calcMedicao e updateBMPeriodQuantities.
//
// Regras (confirmadas pelo usuário):
//  - a qtd do período é TRAVADA no saldo (não mede além do contratado);
//  - o "anterior" soma apenas BMs com status APROVADA e número menor que a atual.
//
// items_override: [{ contrato_item_id, qtd_periodo_input, override_manual? }]
// Retorna { items, totals, groups, bm }.
export async function calcularBM({ bm_id, items_override = [], persist = false, userEmail = null }) {
  if (!bm_id) throw Object.assign(new Error('bm_id obrigatório'), { status: 400 });

  const [bm] = await store.filter('BM', { id: bm_id }, null, 1);
  if (!bm) throw Object.assign(new Error('BM não encontrado'), { status: 404 });
  if (persist && bm.status === 'APROVADA') {
    throw Object.assign(new Error('BM aprovada não pode ser alterada'), { status: 409 });
  }

  const contratoItems = (await store.filter('ContratoItem', { contrato_versao_id: bm.contrato_versao_id }) || [])
    .sort((a, b) => num(a.ordem) - num(b.ordem));

  // Anterior = soma de qtd_periodo_final das BMs APROVADAS com número < atual.
  const numeroAtual = num(bm.numero);
  const todasBMs = await store.filter('BM', { contrato_versao_id: bm.contrato_versao_id }) || [];
  const idsAnteriores = todasBMs
    .filter((b) => b.status === 'APROVADA' && num(b.numero) < numeroAtual)
    .map((b) => b.id);

  const anteriorPorItem = {};
  if (idsAnteriores.length) {
    const itensAnteriores = await store.filter('BMItem', { bm_id: { $in: idsAnteriores } }) || [];
    for (const it of itensAnteriores) {
      anteriorPorItem[it.contrato_item_id] = (anteriorPorItem[it.contrato_item_id] || 0) + num(it.qtd_periodo_final);
    }
  }

  const itensDesteBM = await store.filter('BMItem', { bm_id }) || [];
  const bmItemPorContrato = {};
  for (const it of itensDesteBM) bmItemPorContrato[it.contrato_item_id] = it;

  const overrideMap = {};
  for (const o of (items_override || [])) overrideMap[o.contrato_item_id] = o;

  const items = [];
  const groupsMap = {};
  let total_anterior = 0, total_periodo = 0, total_acumulado = 0, total_saldo = 0, total_contrato = 0;

  for (const ci of contratoItems) {
    const pu = num(ci.preco_unit_com_bdi) || num(ci.preco_unit);
    const qtdContrato = num(ci.qtd_contrato);
    const qtdAnterior = anteriorPorItem[ci.id] || 0;
    const saldoAntes = Math.max(0, qtdContrato - qtdAnterior);

    let qtdPeriodoInput;
    if (overrideMap[ci.id] && overrideMap[ci.id].qtd_periodo_input != null) {
      qtdPeriodoInput = num(overrideMap[ci.id].qtd_periodo_input);
    } else if (bmItemPorContrato[ci.id]) {
      qtdPeriodoInput = num(bmItemPorContrato[ci.id].qtd_periodo_input);
    } else {
      qtdPeriodoInput = 0;
    }

    // Trava no saldo.
    const qtdPeriodoFinal = Math.min(Math.max(0, qtdPeriodoInput), saldoAntes);

    const qtdAcumulada = qtdAnterior + qtdPeriodoFinal;
    const qtdSaldo = Math.max(0, qtdContrato - qtdAcumulada);

    const vlAnterior = qtdAnterior * pu;
    const vlPeriodo = qtdPeriodoFinal * pu;
    const vlAcumulado = qtdAcumulada * pu;
    const vlSaldo = qtdSaldo * pu;

    items.push({
      contrato_item_id: ci.id,
      qtd_anterior: qtdAnterior,
      vl_anterior: vlAnterior,
      qtd_periodo_input: qtdPeriodoInput,
      qtd_periodo_final: qtdPeriodoFinal,
      vl_periodo: vlPeriodo,
      qtd_acumulada: qtdAcumulada,
      vl_acumulado: vlAcumulado,
      qtd_saldo: qtdSaldo,
      vl_saldo: vlSaldo,
      override_manual: !!overrideMap[ci.id]?.override_manual,
    });

    const g = ci.grupo || 'Sem grupo';
    if (!groupsMap[g]) groupsMap[g] = { grupo: g, vl_anterior: 0, vl_periodo: 0, vl_acumulado: 0, vl_saldo: 0 };
    groupsMap[g].vl_anterior += vlAnterior;
    groupsMap[g].vl_periodo += vlPeriodo;
    groupsMap[g].vl_acumulado += vlAcumulado;
    groupsMap[g].vl_saldo += vlSaldo;

    total_anterior += vlAnterior;
    total_periodo += vlPeriodo;
    total_acumulado += vlAcumulado;
    total_saldo += vlSaldo;
    total_contrato += qtdContrato * pu;
  }

  const percent_concluida = total_contrato > 0 ? (total_acumulado / total_contrato) * 100 : 0;
  const totals = { total_anterior, total_periodo, total_acumulado, total_saldo, total_contrato, percent_concluida };
  const groups = Object.values(groupsMap);

  if (persist) {
    for (const it of items) {
      const existente = bmItemPorContrato[it.contrato_item_id];
      const payload = {
        bm_id,
        contrato_item_id: it.contrato_item_id,
        qtd_periodo_input: it.qtd_periodo_input,
        qtd_periodo_final: it.qtd_periodo_final,
        qtd_acumulada: it.qtd_acumulada,
        vl_periodo: it.vl_periodo,
        vl_acumulado: it.vl_acumulado,
        override_manual: it.override_manual,
      };
      if (existente) {
        await store.update('BMItem', existente.id, payload);
      } else if (it.qtd_periodo_final > 0) {
        await store.create('BMItem', payload, userEmail || null);
      }
    }
    await store.update('BM', bm_id, {
      total_anterior, total_periodo, total_acumulado, total_contrato, percent_concluida,
    });
  }

  return { items, totals, groups, bm: { id: bm_id, numero: bm.numero, status: bm.status } };
}
