import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Atualiza quantidades do período de um BM e recalcula usando o serviço central
// Entrada: { bm_id: string, items: [{ contrato_item_id, qtd_periodo_input, override_manual? }] }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const bmId = body?.bm_id;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!bmId) return Response.json({ error: 'bm_id é obrigatório' }, { status: 400 });

    // Validar BM
    const bmList = await base44.asServiceRole.entities.BM.filter({ id: bmId });
    const bm = bmList?.[0];
    if (!bm) return Response.json({ error: 'BM não encontrado' }, { status: 404 });

    // Upsert de BMItems do período
    for (const it of items) {
      const contratoItemId = it?.contrato_item_id;
      if (!contratoItemId) continue;
      const qtdPeriodo = Number(it?.qtd_periodo_input || 0);
      const overrideManual = Boolean(it?.override_manual || false);

      const existentes = await base44.asServiceRole.entities.BMItem.filter({ bm_id: bmId, contrato_item_id: contratoItemId });
      const existente = existentes?.[0];
      if (existente) {
        await base44.asServiceRole.entities.BMItem.update(existente.id, {
          qtd_periodo_input: qtdPeriodo,
          override_manual: overrideManual,
        });
      } else {
        await base44.asServiceRole.entities.BMItem.create({
          bm_id: bmId,
          contrato_item_id: contratoItemId,
          qtd_anterior: 0,
          vl_anterior: 0,
          qtd_periodo_input: qtdPeriodo,
          override_manual: overrideManual,
        });
      }
    }

    // Recalcular e persistir
    const res = await base44.asServiceRole.functions.invoke('calcMedicao', {
      bm_id: bmId,
      persist: true,
    });

    return Response.json({ success: true, result: res.data });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});