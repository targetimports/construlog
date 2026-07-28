/**
 * reconciliarBMComPDF — Compara totais calculados de uma BM com valores esperados do PDF oficial.
 *
 * Útil para auditoria/encerramento: confirma que o motor de cálculo bate com o boletim físico.
 *
 * POST { bm_id, esperado_periodo, esperado_acumulado, esperado_saldo }
 * Retorna: { ok, bm_id, numero, calculado, esperado, diferencas, apto }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

function TRUNC2(x) {
  if (x === null || x === undefined) return 0;
  const d = new Decimal(x);
  if (d.isZero()) return 0;
  const scaled = d.mul(100);
  const truncated = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return truncated.div(100).toNumber();
}

const TOL = 0.02; // tolerância de R$ 0,02 (diferença de centavo de arredondamento)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    const {
      bm_id,
      esperado_periodo,
      esperado_acumulado,
      esperado_saldo,
    } = payload;

    if (!bm_id) return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });

    // ─── 1. Carregar BM ───────────────────────────────────────────────────────
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bm  = bms[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    // ─── 2. Carregar itens do contrato e BMItems ───────────────────────────────
    const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({
      contrato_versao_id: bm.contrato_versao_id
    }) || [];
    const bmItems = await base44.asServiceRole.entities.BMItem.filter({ bm_id }) || [];
    const bmItemByContratoId = Object.fromEntries(bmItems.map(bmi => [bmi.contrato_item_id, bmi]));

    // ─── 3. BMs APROVADAS anteriores (excluindo self por id) ──────────────────
    const todasAprovadas = await base44.asServiceRole.entities.BM.filter({
      obra_id: bm.obra_id,
      contrato_versao_id: bm.contrato_versao_id,
      status: 'APROVADA'
    }) || [];
    const prevBMs = todasAprovadas.filter(b => b.id !== bm_id && b.status === 'APROVADA');

    const qtdAnteriorMap = {};
    for (const pbm of prevBMs) {
      const prevItems = await base44.asServiceRole.entities.BMItem.filter({ bm_id: pbm.id }) || [];
      for (const it of prevItems) {
        const cid = it.contrato_item_id;
        qtdAnteriorMap[cid] = (qtdAnteriorMap[cid] || new Decimal(0)).add(new Decimal(it.qtd_periodo_final || 0));
      }
    }

    // ─── 4. Recalcular totais sem dependências (auditoria pura) ───────────────
    let sumPeriodo   = new Decimal(0);
    let sumAcumulado = new Decimal(0);
    let sumSaldo     = new Decimal(0);
    let sumContrato  = new Decimal(0);

    const detalhes = [];
    for (const ci of contratoItems) {
      const pu        = new Decimal(ci.preco_unit_com_bdi || ci.preco_unit || 0);
      const qtdContr  = new Decimal(ci.qtd_contrato || 0);
      const precoTot  = ci.preco_total ? new Decimal(ci.preco_total) : qtdContr.mul(pu);
      const qtdAnt    = qtdAnteriorMap[ci.id] || new Decimal(0);
      const bmi       = bmItemByContratoId[ci.id] || {};
      const qtdPer    = new Decimal(bmi.qtd_periodo_final || 0);
      const qtdAcum   = qtdAnt.add(qtdPer);

      const vlPer     = qtdPer.mul(pu);
      const vlAnt     = qtdAnt.mul(pu);
      const vlAcum    = vlAnt.add(vlPer);
      const vlSaldo   = precoTot.sub(vlAcum);

      sumContrato  = sumContrato.add(precoTot);
      sumPeriodo   = sumPeriodo.add(vlPer);
      sumAcumulado = sumAcumulado.add(vlAcum);
      sumSaldo     = sumSaldo.add(vlSaldo);

      if (vlPer.gt(0)) {
        detalhes.push({
          codigo:      ci.item_codigo,
          descricao:   ci.descricao?.slice(0, 60),
          qtd_anterior: qtdAnt.toNumber(),
          qtd_periodo:  qtdPer.toNumber(),
          vl_periodo:   TRUNC2(vlPer.toNumber()),
          vl_acumulado: TRUNC2(vlAcum.toNumber()),
          vl_saldo:     TRUNC2(vlSaldo.toNumber()),
        });
      }
    }

    const calculado = {
      total_periodo:   TRUNC2(sumPeriodo.toNumber()),
      total_acumulado: TRUNC2(sumAcumulado.toNumber()),
      total_saldo:     TRUNC2(sumSaldo.toNumber()),
      total_contrato:  TRUNC2(sumContrato.toNumber()),
    };

    // ─── 5. Comparar com esperado do PDF ──────────────────────────────────────
    const esperado = {
      total_periodo:   esperado_periodo   != null ? Number(esperado_periodo)   : null,
      total_acumulado: esperado_acumulado != null ? Number(esperado_acumulado) : null,
      total_saldo:     esperado_saldo     != null ? Number(esperado_saldo)     : null,
    };

    const diferencas = {};
    let apto = true;

    for (const campo of ['total_periodo', 'total_acumulado', 'total_saldo']) {
      if (esperado[campo] != null) {
        const diff = Math.abs(calculado[campo] - esperado[campo]);
        const ok   = diff <= TOL;
        diferencas[campo] = {
          calculado: calculado[campo],
          esperado:  esperado[campo],
          diferenca: TRUNC2(calculado[campo] - esperado[campo]),
          ok,
        };
        if (!ok) apto = false;
      }
    }

    console.log('[reconciliarBMComPDF]', JSON.stringify({
      bm_id,
      numero: bm.numero,
      calculado,
      apto,
      diferencas
    }));

    return Response.json({
      ok: true,
      bm_id,
      numero: bm.numero,
      status: bm.status,
      bms_anteriores_aprovadas: prevBMs.length,
      calculado,
      esperado,
      diferencas,
      apto,
      tolerancia_centavos: TOL,
      amostra_itens_periodo: detalhes.slice(0, 10),
    });

  } catch (error) {
    console.error('[reconciliarBMComPDF]', error?.message);
    return Response.json({ ok: false, error: error?.message || 'Erro' }, { status: 500 });
  }
});