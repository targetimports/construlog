import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { bm_id, suggestion_ids, motivo } = body || {};
    if (!bm_id || !Array.isArray(suggestion_ids) || suggestion_ids.length === 0) {
      return Response.json({ error: 'bm_id e suggestion_ids são obrigatórios' }, { status: 400 });
    }

    const bmList = await base44.asServiceRole.entities.BM.filter({ id: bm_id });
    const bm = bmList?.[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    let rejected = 0;
    for (const id of suggestion_ids) {
      const s = await base44.asServiceRole.entities.IASugestaoBMItem.filter({ id });
      if (!s?.[0]) continue;
      if (s[0].bm_id !== bm_id) continue;
      await base44.asServiceRole.entities.IASugestaoBMItem.update(id, { status: 'rejeitada', motivo_rejeicao: motivo || null });
      rejected += 1;
    }

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        obra_id: bm.obra_id,
        entidade: 'BM',
        entidade_id: bm_id,
        acao: 'update',
        usuario_id: user.email,
        observacao: `IA: ${rejected} sugestões rejeitadas por ${user.email}${motivo ? `; motivo: ${motivo}` : ''}`
      });
    } catch (_) {}

    return Response.json({ success: true, rejected });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});