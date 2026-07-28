import { store } from '../entityStore.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Motor de cálculo da medição (calcBMv2).
// - Lê itens do contrato (com etapa/trecho), acumulado das BMs anteriores
//   aprovadas e inputs/override desta BM; calcula por item: anterior, período,
//   acumulado, saldo e valores, além de peso (%) e evolução por etapa.
// - Respeita tolerância configurável (ConfiguracaoMedicao.tolerancia_percentual).
// - Com persist=true, grava os BMItem e os totais da BM.
export default async function calcBMv2({ body, user }) {
  const { bm_id, persist, items_override } = body || {};
  if (!bm_id) throw Object.assign(new Error('bm_id obrigatório'), { status: 400 });

  const bm = (await store.filter('BM', { id: bm_id }))[0];
  if (!bm) throw Object.assign(new Error('BM não encontrada'), { status: 404 });

  const contratoItens = (await store.filter('ContratoItem', { contrato_versao_id: bm.contrato_versao_id })) || [];

  // Tolerância configurável (% acima do contratado permitido). Default 0.
  // Preferência: config do contrato; fallback: config da obra.
  let tolerancia = 0;
  try {
    let cfgs = (await store.filter('ConfiguracaoMedicao', { obra_id: bm.obra_id, contrato_versao_id: bm.contrato_versao_id })) || [];
    if (cfgs.length === 0) cfgs = (await store.filter('ConfiguracaoMedicao', { obra_id: bm.obra_id })) || [];
    tolerancia = Number(cfgs?.[0]?.tolerancia_percentual) || 0;
  } catch (_) { tolerancia = 0; }

  // Acumulado das BMs anteriores APROVADAS (numero < atual) na mesma versão.
  const todasBMs = (await store.filter('BM', { contrato_versao_id: bm.contrato_versao_id })) || [];
  const anteriores = todasBMs.filter((b) => b.status === 'APROVADA' && Number(b.numero) < Number(bm.numero));
  const qtdAnteriorPorItem = {};
  for (const b of anteriores) {
    const its = (await store.filter('BMItem', { bm_id: b.id })) || [];
    for (const it of its) {
      qtdAnteriorPorItem[it.contrato_item_id] = (qtdAnteriorPorItem[it.contrato_item_id] || 0) + (Number(it.qtd_periodo_final) || 0);
    }
  }

  const bmItensAtuais = (await store.filter('BMItem', { bm_id })) || [];
  const inputPorItem = {};
  for (const it of bmItensAtuais) inputPorItem[it.contrato_item_id] = it;

  const overrideMap = {};
  for (const ov of (items_override || [])) if (ov && ov.contrato_item_id) overrideMap[ov.contrato_item_id] = ov;

  const validation_errors = [];
  const itemsRaw = [];
  const gruposMap = {};
  let total_contrato = 0, total_anterior = 0, total_periodo = 0;

  for (const ci of contratoItens) {
    const preco = Number(ci.preco_unit_com_bdi) || Number(ci.preco_unit) || 0;
    const qtdContrato = Number(ci.qtd_contrato) || 0;
    const qtdAnterior = qtdAnteriorPorItem[ci.id] || 0;
    const saldoMax = qtdContrato * (1 + tolerancia / 100);
    const saldoDisp = Math.max(0, saldoMax - qtdAnterior);

    let qtdInput = 0;
    let overrideManual = false;
    if (overrideMap[ci.id] != null) {
      qtdInput = Number(overrideMap[ci.id].qtd_periodo_input) || 0;
      overrideManual = !!overrideMap[ci.id].override_manual;
    } else if (inputPorItem[ci.id] != null) {
      qtdInput = Number(inputPorItem[ci.id].qtd_periodo_input) || 0;
      overrideManual = !!inputPorItem[ci.id].override_manual;
    }

    let qtdPeriodoFinal = qtdInput;
    let recortado = false;
    if (qtdPeriodoFinal > saldoDisp) {
      const limite = tolerancia > 0 ? `${r2(saldoDisp)} (contrato + ${tolerancia}% tolerância)` : `${r2(saldoDisp)}`;
      validation_errors.push({ contrato_item_id: ci.id, mensagem: `${ci.descricao}: medido ${qtdPeriodoFinal} excede o saldo ${limite} — ajustado.` });
      qtdPeriodoFinal = saldoDisp;
      recortado = true;
    }

    const qtdAcumulada = qtdAnterior + qtdPeriodoFinal;
    const qtdSaldo = qtdContrato - qtdAcumulada;

    const vl_anterior = r2(qtdAnterior * preco);
    const vl_periodo = r2(qtdPeriodoFinal * preco);
    const vl_acumulado = r2(qtdAcumulada * preco);
    const vl_saldo = r2(qtdSaldo * preco);
    const vl_contrato = qtdContrato * preco;

    total_contrato += vl_contrato;
    total_anterior += qtdAnterior * preco;
    total_periodo += qtdPeriodoFinal * preco;

    const grupo = ci.etapa || ci.grupo || 'Geral';
    if (!gruposMap[grupo]) gruposMap[grupo] = { grupo, vl_contrato: 0, vl_anterior: 0, vl_periodo: 0, vl_acumulado: 0, vl_saldo: 0 };
    gruposMap[grupo].vl_contrato += vl_contrato;
    gruposMap[grupo].vl_anterior += vl_anterior;
    gruposMap[grupo].vl_periodo += vl_periodo;
    gruposMap[grupo].vl_acumulado += vl_acumulado;
    gruposMap[grupo].vl_saldo += vl_saldo;

    itemsRaw.push({
      contrato_item_id: ci.id,
      item_codigo: ci.item_codigo,
      item_label: ci.item_label || ci.descricao,
      descricao: ci.descricao,
      unidade: ci.unidade,
      etapa: grupo,
      trecho: ci.trecho || '',
      preco_unit_com_bdi: preco,
      qtd_contrato: qtdContrato, vl_contrato: r2(vl_contrato),
      qtd_anterior: qtdAnterior, vl_anterior,
      qtd_periodo_input: qtdInput, qtd_periodo_final: qtdPeriodoFinal, vl_periodo,
      qtd_acumulada: qtdAcumulada, vl_acumulado,
      qtd_saldo: qtdSaldo, vl_saldo,
      override_manual: overrideManual,
      _recortado: recortado,
      _has_dependency: false,
    });
  }

  total_contrato = r2(total_contrato);
  total_anterior = r2(total_anterior);
  total_periodo = r2(total_periodo);
  const total_acumulado = r2(total_anterior + total_periodo);
  const total_saldo = r2(total_contrato - total_acumulado);
  const percent_concluida = total_contrato > 0 ? r2((total_acumulado / total_contrato) * 100) : 0;

  // Peso (%) de cada item sobre o total do contrato.
  const items = itemsRaw.map((it) => ({
    ...it,
    peso_percentual: total_contrato > 0 ? r2((it.vl_contrato / total_contrato) * 100) : 0,
    percent_fisico_item: it.qtd_contrato > 0 ? r2((it.qtd_acumulada / it.qtd_contrato) * 100) : 0,
  }));

  const totals = { total_contrato, total_anterior, total_periodo, total_acumulado, total_saldo, percent_concluida };
  const groups = Object.values(gruposMap).map((g) => ({
    grupo: g.grupo,
    vl_anterior: r2(g.vl_anterior),
    vl_periodo: r2(g.vl_periodo),
    vl_acumulado: r2(g.vl_acumulado),
    vl_saldo: r2(g.vl_saldo),
    peso_percentual: total_contrato > 0 ? r2((g.vl_contrato / total_contrato) * 100) : 0,
    percent_concluida: g.vl_contrato > 0 ? r2((g.vl_acumulado / g.vl_contrato) * 100) : 0,
  }));

  if (persist) {
    for (const it of items) {
      const existente = inputPorItem[it.contrato_item_id];
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
      if (existente) await store.update('BMItem', existente.id, payload).catch(() => {});
      else if (it.qtd_periodo_input > 0) await store.create('BMItem', payload, user?.email || null);
    }
    await store.update('BM', bm_id, {
      total_contrato, total_anterior, total_periodo, total_acumulado, total_saldo, percent_concluida,
    }).catch(() => {});
  }

  return {
    status: bm.status,
    items,
    totals,
    groups,
    validation_errors,
    diagnostico: {
      bm_id,
      obra_id: bm.obra_id,
      contrato_versao_id: bm.contrato_versao_id,
      contrato_itens_count: contratoItens.length,
      bm_items_count: bmItensAtuais.length,
      tolerancia_percentual: tolerancia,
      aviso: contratoItens.length === 0 ? 'Contrato sem itens cadastrados.' : undefined,
    },
  };
}
