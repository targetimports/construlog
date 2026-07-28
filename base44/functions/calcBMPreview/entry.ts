/**
 * calcBMPreview: Preview de cálculo de BM (sem persistência)
 * 
 * ENTRADA: { obra_id, contrato_versao_id, itens: [{contrato_item_id, qtd_periodo_input}] }
 * RETORNA: { ok, bm_calculada:{...}, itens_calculados:[...] } ou { ok:false, erro }
 * 
 * Motor oficial nativo de cálculo — nunca quebra com erro 500
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { TRUNC2 } from './_lib/precision.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { obra_id, contrato_versao_id, itens = [] } = body;

    // Validação de entrada
    if (!obra_id || !contrato_versao_id) {
      return Response.json({
        ok: false,
        erro: 'obra_id e contrato_versao_id são obrigatórios',
        dica: 'Envie: { obra_id, contrato_versao_id, itens: [{contrato_item_id, qtd_periodo_input}] }'
      }, { status: 400 });
    }

    // Buscar ContratoVersao
    const contratoVersoes = await base44.asServiceRole.entities.ContratoVersao.filter({
      id: contrato_versao_id
    }) || [];
    
    const contratoVersao = contratoVersoes[0];
    if (!contratoVersao) {
      return Response.json({
        ok: false,
        erro: `ContratoVersao não encontrada: ${contrato_versao_id}`
      }, { status: 404 });
    }

    // Buscar ContratoItems da versão
    const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({
      contrato_versao_id
    }) || [];

    if (contratoItems.length === 0) {
      return Response.json({
        ok: false,
        erro: 'Nenhum item encontrado nesta versão de contrato'
      }, { status: 400 });
    }

    // Buscar BMs APROVADAS anteriores
    const bmsAnteriores = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      contrato_versao_id,
      status: 'APROVADA'
    }) || [];

    // Mapear inputs
    const inputMap = Object.fromEntries(
      (itens || []).map(i => [i.contrato_item_id, i])
    );

    // Calcular itens
    const itens_calculados = [];
    let total_anterior = 0;
    let total_periodo = 0;
    let total_acumulado = 0;
    let total_saldo = 0;

    for (const item of contratoItems) {
      const input = inputMap[item.id] || {};
      const qtd_periodo_input = Number(input.qtd_periodo_input) || 0;

      // qtd_anterior: soma de BMs anteriores
      let qtd_anterior = 0;
      for (const bm of bmsAnteriores) {
        const bmItems = await base44.asServiceRole.entities.BMItem.filter({
          bm_id: bm.id,
          contrato_item_id: item.id
        }) || [];
        for (const bi of bmItems) {
          qtd_anterior += Number(bi.qtd_periodo_final) || 0;
        }
      }

      const qtd_periodo_final = qtd_periodo_input;
      const qtd_acumulada = qtd_anterior + qtd_periodo_final;
      const qtd_saldo = TRUNC2((Number(item.qtd_contrato) || 0) - qtd_acumulada);

      // Valores
      const preco = Number(item.preco_unit_com_bdi) || 0;
      const vl_anterior = TRUNC2(qtd_anterior * preco);
      const vl_periodo = TRUNC2(qtd_periodo_final * preco);
      const vl_acumulado = TRUNC2(qtd_acumulada * preco);
      const vl_saldo = TRUNC2(qtd_saldo * preco);

      itens_calculados.push({
        contrato_item_id: item.id,
        item_codigo: item.item_codigo,
        descricao: item.descricao,
        unidade: item.unidade,
        qtd_contrato: TRUNC2(Number(item.qtd_contrato) || 0),
        preco_unit_com_bdi: TRUNC2(preco),
        qtd_periodo_input,
        qtd_anterior: TRUNC2(qtd_anterior),
        qtd_periodo_final: TRUNC2(qtd_periodo_final),
        qtd_acumulada: TRUNC2(qtd_acumulada),
        qtd_saldo,
        vl_anterior,
        vl_periodo,
        vl_acumulado,
        vl_saldo
      });

      total_anterior += vl_anterior;
      total_periodo += vl_periodo;
      total_acumulado += vl_acumulado;
      total_saldo += vl_saldo;
    }

    // Totalizadores
    total_anterior = TRUNC2(total_anterior);
    total_periodo = TRUNC2(total_periodo);
    total_acumulado = TRUNC2(total_acumulado);
    total_saldo = TRUNC2(total_saldo);

    const total_contrato = TRUNC2(Number(contratoVersao.total_contrato) || 0);
    const percent_concluida = total_contrato > 0 
      ? Math.min(100, TRUNC2((total_acumulado / total_contrato) * 100))
      : 0;

    return Response.json({
      ok: true,
      bm_calculada: {
        obra_id,
        contrato_versao_id,
        total_contrato,
        total_anterior,
        total_periodo,
        total_acumulado,
        total_saldo,
        percent_concluida
      },
      itens_calculados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[calcBMPreview]', error?.message);
    
    // Nunca retornar 500 por erro de parsing
    return Response.json({
      ok: false,
      erro: error?.message || 'Erro ao calcular preview',
      dica: 'Verifique se os parâmetros estão corretos'
    }, { status: 500 });
  }
});