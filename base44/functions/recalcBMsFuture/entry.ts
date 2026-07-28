import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const bmId = body?.bm_id;
    if (!bmId) return Response.json({ error: 'bm_id é obrigatório' }, { status: 400 });

    const bmArr = await base44.asServiceRole.entities.BM.filter({ id: bmId });
    if (!bmArr?.[0]) return Response.json({ error: 'BM não encontrada' }, { status: 404 });
    const bm = bmArr[0];

    const { obra_id, contrato_versao_id, numero: bm_numero_inicial } = bm;

    // 1) Recalcula BM atual (persistente)
    await base44.asServiceRole.functions.invoke('calcBM', { bm_id: bmId, persist: true });

    // 2) Buscar BMs futuras (mesma versão, numero > atual)
    const todas = await base44.asServiceRole.entities.BM.filter({ obra_id, contrato_versao_id });
    const futuras = (todas || []).filter(b => (b.numero || 0) > (bm_numero_inicial || 0)).sort((a,b) => (a.numero||0) - (b.numero||0));

    const detalhes = [];
    for (const bf of futuras) {
      const { data } = await base44.asServiceRole.functions.invoke('calcBM', { bm_id: bf.id, persist: true });
      detalhes.push({ bm_id: bf.id, bm_numero: bf.numero, totals: data?.totals });
    }

    return Response.json({ success: true, bm_id_atual: bmId, bm_numero_inicial, bms_futuras_recalculadas: detalhes.length, detalhes });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});