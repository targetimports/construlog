import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const bmId = body?.bm_id;
    if (!bmId) return Response.json({ error: 'bm_id é obrigatório' }, { status: 400 });

    const list = await base44.asServiceRole.entities.BM.filter({ id: bmId });
    const bm = list?.[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    if (bm.status === 'APROVADA') {
      return Response.json({ error: 'BM já aprovada' }, { status: 400 });
    }

    // GUARD: não aprovar BM sem itens
    const bmItems = await base44.asServiceRole.entities.BMItem.filter({ bm_id: bmId }) || [];
    console.log(`[approveBM] GUARD: bm_id=${bmId} bmItems=${bmItems.length}`);
    if (bmItems.length === 0) {
      return Response.json({
        code: 'BM_SEM_ITENS',
        error: 'Não é possível aprovar uma BM sem itens. Pré-carregue os itens primeiro.'
      }, { status: 400 });
    }

    // ── BM_AUDIT ──
    console.log(JSON.stringify({
      tag: 'BM_AUDIT',
      fn: 'approveBM',
      bm_id: bmId,
      obra_id: bm.obra_id,
      contrato_versao_id: bm.contrato_versao_id,
      qtd_bm_items: bmItems.length,
      total_contrato: bm.total_contrato,
      total_periodo: bm.total_periodo,
      total_acumulado: bm.total_acumulado,
      sample_bm_item: bmItems[0] ? {
        id: bmItems[0].id,
        contrato_item_id: bmItems[0].contrato_item_id,
        qtd_periodo_input: bmItems[0].qtd_periodo_input,
        qtd_periodo_final: bmItems[0].qtd_periodo_final,
        vl_periodo: bmItems[0].vl_periodo,
        vl_acumulado: bmItems[0].vl_acumulado
      } : null
    }));

    // Calcula e persiste antes de aprovar (garante consistência dos valores)
    await base44.asServiceRole.functions.invoke('calcBM', { bm_id: bmId, persist: true });

    // Aprovar
    await base44.asServiceRole.entities.BM.update(bmId, { status: 'APROVADA' });

    return Response.json({ success: true, bm_id: bmId, status: 'APROVADA' });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});