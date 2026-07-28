/**
 * preloadBMItems: Pré-carrega BMItems para uma BM existente
 * 
 * Função IDEMPOTENTE:
 * - Se já existem BMItems para a BM → retorna sucesso sem duplicar
 * - Se ContratoVersao não tem itens → retorna erro 400
 * - Se não existem BMItems → cria 1 por ContratoItem
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bm_id } = await req.json();
    if (!bm_id) {
      return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });
    }

    // 1) Buscar BM
    const bms = await base44.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) {
      return Response.json({ error: 'BM não encontrada' }, { status: 404 });
    }

    const { contrato_versao_id, obra_id } = bm;
    console.log(`[preloadBMItems] bm_id=${bm_id} obra_id=${obra_id} contrato_versao_id=${contrato_versao_id}`);

    // 2) Buscar ContratoItem da versão
    const contratoItems = await base44.entities.ContratoItem.filter({ contrato_versao_id }) || [];
    console.log(`[preloadBMItems] contratoItems.length=${contratoItems.length}`);

    if (contratoItems.length === 0) {
      return Response.json({
        ok: false,
        code: 'CONTRATO_SEM_ITENS',
        error: 'Esta versão de contrato não possui itens. Cadastre os itens antes de pré-carregar.',
        bm_id,
        contrato_versao_id,
        obra_id
      }, { status: 400 });
    }

    // 3) Verificar se já existem BMItems (idempotência)
    const bmItemsExistentes = await base44.entities.BMItem.filter({ bm_id }) || [];
    console.log(`[preloadBMItems] bmItems existentes=${bmItemsExistentes.length}`);

    if (bmItemsExistentes.length > 0) {
      // ── BM_PRELOAD_RESULT (skip) ──
      console.log(JSON.stringify({
        tag: 'BM_PRELOAD_RESULT',
        fn: 'preloadBMItems',
        bm_id,
        obra_id,
        contrato_versao_id,
        before: bmItemsExistentes.length,
        after: bmItemsExistentes.length,
        action: 'SKIP_ALREADY_EXISTS',
        sample_bm_item: bmItemsExistentes[0] ? {
          id: bmItemsExistentes[0].id,
          contrato_item_id: bmItemsExistentes[0].contrato_item_id,
          qtd_periodo_input: bmItemsExistentes[0].qtd_periodo_input,
          qtd_anterior: bmItemsExistentes[0].qtd_anterior,
          vl_periodo: bmItemsExistentes[0].vl_periodo,
          vl_saldo: bmItemsExistentes[0].vl_saldo
        } : null
      }));
      return Response.json({
        ok: true,
        preloaded: false,
        message: `BMItems já existem (${bmItemsExistentes.length} itens). Nenhuma duplicação.`,
        bm_id,
        bm_items_count: bmItemsExistentes.length,
        contrato_itens_count: contratoItems.length
      });
    }

    // 4) Criar BMItem para cada ContratoItem
    let criados = 0;
    let erros = 0;
    for (const ci of contratoItems) {
      try {
        await base44.entities.BMItem.create({
          bm_id,
          contrato_item_id: ci.id,
          qtd_periodo_input: 0,
          override_manual: false,
          qtd_anterior: 0,
          qtd_periodo_final: 0,
          qtd_acumulada: 0,
          qtd_saldo: ci.qtd_contrato || 0,
          vl_anterior: 0,
          vl_periodo: 0,
          vl_acumulado: 0,
          vl_saldo: ci.preco_total || 0
        });
        criados++;
      } catch (e) {
        console.warn(`[preloadBMItems] Erro criando BMItem para ci=${ci.id}:`, e.message);
        erros++;
      }
    }

    // ── BM_PRELOAD_RESULT (created) ──
    // Re-fetch para prova real do que foi persistido
    const bmItemsAfter = await base44.entities.BMItem.filter({ bm_id }) || [];
    const sampleAfter = bmItemsAfter[0] || null;
    console.log(JSON.stringify({
      tag: 'BM_PRELOAD_RESULT',
      fn: 'preloadBMItems',
      bm_id,
      obra_id,
      contrato_versao_id,
      before: 0,
      after: bmItemsAfter.length,
      criados,
      erros,
      qtd_contrato_itens: contratoItems.length,
      total_contrato_sum: contratoItems.reduce((s, ci) => s + (ci.preco_total || 0), 0),
      sample_contrato_item: contratoItems[0] ? {
        id: contratoItems[0].id,
        unidade: contratoItems[0].unidade,
        qtd_contrato: contratoItems[0].qtd_contrato,
        preco_unit_com_bdi: contratoItems[0].preco_unit_com_bdi,
        preco_total: contratoItems[0].preco_total
      } : null,
      sample_bm_item: sampleAfter ? {
        id: sampleAfter.id,
        contrato_item_id: sampleAfter.contrato_item_id,
        qtd_periodo_input: sampleAfter.qtd_periodo_input,
        qtd_anterior: sampleAfter.qtd_anterior,
        qtd_saldo: sampleAfter.qtd_saldo,
        vl_saldo: sampleAfter.vl_saldo
      } : null,
      BUG_ALERT: bmItemsAfter.length === 0 && contratoItems.length > 0 ? 'AFTER=0 COM CONTRATO_ITENS>0' : 'OK'
    }));

    return Response.json({
      ok: true,
      preloaded: true,
      message: `${criados} BMItem(s) criado(s) com sucesso.`,
      bm_id,
      bm_items_criados: criados,
      bm_items_erros: erros,
      contrato_itens_count: contratoItems.length
    });

  } catch (error) {
    console.error('[preloadBMItems] ERRO:', error?.message, error?.stack);
    return Response.json({ ok: false, error: error?.message || 'Erro ao pré-carregar itens' }, { status: 500 });
  }
});