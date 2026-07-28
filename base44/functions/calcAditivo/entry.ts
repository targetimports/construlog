/**
 * calcAditivo: Motor de cálculo de aditivos
 * 
 * Calcula:
 * - acrescimo_valor, supressao_valor, qtd_consolidada, valor_consolidado por AditivoItem
 * - Totais do aditivo (total_acrescimo, total_supressao, total_liquido)
 * - Validação de Meta Física (limite 25% do contrato)
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try {
      payload = await req.json();
    } catch (e) {
      // Safe JSON
    }

    const { aditivo_id, persist = false } = payload;
    if (!aditivo_id) {
      return Response.json({ error: 'aditivo_id obrigatório' }, { status: 400 });
    }

    // Buscar aditivo
    const aditivos = await base44.entities.Aditivo.filter({ id: aditivo_id }) || [];
    const aditivo = aditivos[0];
    if (!aditivo) {
      return Response.json({ error: 'Aditivo não encontrado' }, { status: 404 });
    }

    // Buscar contrato versão origem
    const versoes = await base44.entities.ContratoVersao.filter({
      id: aditivo.contrato_versao_origem_id
    }) || [];
    const versao = versoes[0];
    if (!versao) {
      return Response.json({ error: 'ContratoVersao não encontrada' }, { status: 404 });
    }

    // Buscar itens do contrato
    const contratoItems = await base44.entities.ContratoItem.filter({
      contrato_versao_id: versao.id
    }) || [];
    const contratoById = Object.fromEntries(contratoItems.map(ci => [ci.id, ci]));

    // Buscar AditivoItems
    const aditivoItems = await base44.entities.AditivoItem.filter({
      aditivo_id
    }) || [];

    // Buscar Volumetria (para tipo LEVANTAMENTO_REAL)
    const volumetrias = await base44.entities.Volumetria.filter({
      obra_id: aditivo.obra_id
    }) || [];
    const volumetriaMap = Object.fromEntries(volumetrias.map(v => [v.chave, v.valor_decimal || 0]));

    // Buscar regras de dependência ADITIVO_ACRESCIMO
    const regras = await base44.entities.RegraDependenciaItem.filter({
      contrato_versao_id: versao.id,
      tipo: 'ADITIVO_ACRESCIMO'
    }) || [];
    const regraByTargetCodigo = {};
    for (const r of regras) {
      regraByTargetCodigo[r.target_codigo] = r;
    }

    const contratoByCodigoMap = Object.fromEntries(contratoItems.map(ci => [ci.item_codigo, ci]));

    // Primeiro passe: preparar dados base
    const dataById = {};
    for (const ci of contratoItems) {
      const ai = aditivoItems.find(a => a.contrato_item_id === ci.id);

      const qtdBase = new Decimal(ai?.qtd_base || 0);
      const acrescimoQtdInput = new Decimal(ai?.acrescimo_qtd_input || 0);
      const supressaoQtdInput = new Decimal(ai?.supressao_qtd_input || 0);
      const pu = new Decimal(ci.preco_unit_com_bdi || ci.preco_unit || 0);

      // Para levantamento real: usar volumetria como acrescimo
      let acrescimoQtdFinal = acrescimoQtdInput;
      if (aditivo.tipo === 'LEVANTAMENTO_REAL') {
        const chaveVol = `volume_${ci.item_codigo}`;
        const volValue = volumetriaMap[chaveVol] || 0;
        acrescimoQtdFinal = new Decimal(Math.max(0, volValue - qtdBase.toNumber()));
      }

      const supressaoQtdFinal = supressaoQtdInput;

      const qtdConsolidada = qtdBase.add(acrescimoQtdFinal).sub(supressaoQtdFinal);

      dataById[ci.id] = {
        contrato: ci,
        codigo: ci.item_codigo,
        qtdBase,
        acrescimoQtdInput,
        supressaoQtdInput,
        acrescimoQtdFinal,
        supressaoQtdFinal,
        qtdConsolidada,
        pu,
        aditivoItem: ai,
      };
    }

    // Segundo passe: aplicar dependências ADITIVO_ACRESCIMO
    for (const targetCodigo in regraByTargetCodigo) {
      const regra = regraByTargetCodigo[targetCodigo];
      const targetCi = contratoByCodigoMap[targetCodigo];
      const sourceCi = contratoByCodigoMap[regra.source_codigo];

      if (!targetCi) continue;

      const targetData = dataById[targetCi.id];
      const sourceData = sourceCi ? dataById[sourceCi.id] : null;

      if (!sourceData) continue;

      const fator = new Decimal(regra.fator || 0);
      const sugerido = sourceData.acrescimoQtdFinal.mul(fator);

      let final = sugerido;
      if (regra.aplicar_teto_saldo !== false) {
        const saldoTarget = targetData.qtdBase; // limite é a qtd base
        if (saldoTarget.lt(0)) {
          final = new Decimal(0);
        } else {
          final = Decimal.min(sugerido, saldoTarget);
        }
      }

      targetData.acrescimoQtdFinal = final;
      targetData.qtdConsolidada = targetData.qtdBase.add(final).sub(targetData.supressaoQtdFinal);
    }

    // Consolidar saídas
    let sumAcrescimo = new Decimal(0);
    let sumSupressao = new Decimal(0);

    const itemsOut = [];
    for (const id in dataById) {
      const d = dataById[id];

      const acrescimoValor = TRUNC2(d.acrescimoQtdFinal.mul(d.pu).toNumber());
      const supressaoValor = TRUNC2(d.supressaoQtdFinal.mul(d.pu).toNumber());
      const valorConsolidado = TRUNC2(d.qtdConsolidada.mul(d.pu).toNumber());

      sumAcrescimo = sumAcrescimo.add(acrescimoValor);
      sumSupressao = sumSupressao.add(supressaoValor);

      itemsOut.push({
        id: d.aditivoItem?.id || null,
        aditivo_id,
        contrato_item_id: id,
        item_codigo: d.codigo,
        item_label: d.contrato.item_label,
        qtd_base: d.qtdBase.toNumber(),
        acrescimo_qtd_input: d.acrescimoQtdInput.toNumber(),
        supressao_qtd_input: d.supressaoQtdInput.toNumber(),
        acrescimo_qtd_final: d.acrescimoQtdFinal.toNumber(),
        supressao_qtd_final: d.supressaoQtdFinal.toNumber(),
        qtd_consolidada: d.qtdConsolidada.toNumber(),
        acrescimo_valor: acrescimoValor,
        supressao_valor: supressaoValor,
        valor_consolidado: valorConsolidado,
      });
    }

    const totalAcrescimo = TRUNC2(sumAcrescimo.toNumber());
    const totalSupressao = TRUNC2(sumSupressao.toNumber());
    const totalLiquido = TRUNC2(new Decimal(totalAcrescimo).sub(totalSupressao).toNumber());

    // Validar Meta Física
    const metaFisicaLimite = versao.total_contrato * 0.25;
    const excedeLimite = totalAcrescimo > metaFisicaLimite;

    // Persisting
    if (persist) {
      for (const it of itemsOut) {
        if (it.id) {
          await base44.asServiceRole.entities.AditivoItem.update(it.id, {
            qtd_base: it.qtd_base,
            acrescimo_qtd_input: it.acrescimo_qtd_input,
            supressao_qtd_input: it.supressao_qtd_input,
            acrescimo_qtd_final: it.acrescimo_qtd_final,
            supressao_qtd_final: it.supressao_qtd_final,
            qtd_consolidada: it.qtd_consolidada,
            acrescimo_valor: it.acrescimo_valor,
            supressao_valor: it.supressao_valor,
            valor_consolidado: it.valor_consolidado,
          });
        } else {
          await base44.asServiceRole.entities.AditivoItem.create({
            aditivo_id,
            contrato_item_id: it.contrato_item_id,
            qtd_base: it.qtd_base,
            acrescimo_qtd_input: it.acrescimo_qtd_input,
            supressao_qtd_input: it.supressao_qtd_input,
            acrescimo_qtd_final: it.acrescimo_qtd_final,
            supressao_qtd_final: it.supressao_qtd_final,
            qtd_consolidada: it.qtd_consolidada,
            acrescimo_valor: it.acrescimo_valor,
            supressao_valor: it.supressao_valor,
            valor_consolidado: it.valor_consolidado,
          });
        }
      }

      // Atualizar aditivo
      await base44.asServiceRole.entities.Aditivo.update(aditivo.id, {
        total_acrescimo: totalAcrescimo,
        total_supressao: totalSupressao,
        total_liquido: totalLiquido,
      });
    }

    return Response.json({
      aditivo_id,
      tipo: aditivo.tipo,
      status: aditivo.status,
      persisted: persist,
      totals: {
        total_acrescimo: totalAcrescimo,
        total_supressao: totalSupressao,
        total_liquido: totalLiquido,
      },
      metaFisica: {
        limite: metaFisicaLimite,
        utilizado: totalAcrescimo,
        excede: excedeLimite,
      },
      items: itemsOut,
    });

  } catch (error) {
    console.error('[calcAditivo]', error?.message);
    return Response.json({ error: error?.message || 'Erro ao calcular aditivo' }, { status: 500 });
  }
});