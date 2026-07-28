import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { safeJson } from './_utils/safeJson.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obraId } = await safeJson(req, {});
    if (!obraId) return Response.json({ error: 'ID da obra é obrigatório.' }, { status: 400 });

    let [s] = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.filter({ obra_id: obraId }, '-created_date', 1);

    // Se não houver status, derive APENAS dos itens persistidos
    if (!s) {
      const [orc] = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId }, '-created_date', 1);
      let count = 0;
      if (orc?.id) {
        const itens = await base44.asServiceRole.entities.ItemOrcamento.filter({ orcamento_id: orc.id }, '-created_date', 100000);
        count = itens?.length || 0;
      }
      const inferred = count > 0 ? 'done' : 'pending';
      return Response.json({ obraId, status: inferred, processed: count, total: count, lastError: null, updatedAt: new Date().toISOString() });
    }

    // Recalcular total quando necessário (regra: nunca 0/0 se já existir item)
    // Processados e total devem refletir apenas os itens persistidos
    let processed = 0;
    let total = 0;
    const [orc] = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId }, '-created_date', 1);
    if (orc?.id) {
      const itens = await base44.asServiceRole.entities.ItemOrcamento.filter({ orcamento_id: orc.id }, '-created_date', 100000);
      const count = itens?.length || 0;
      processed = count;
      total = count;
    }

    const map = { PENDING: 'pending', RUNNING: 'running', DONE: 'done', ERROR: 'error' };
    const status = map[s.status] || 'pending';

    return Response.json({
      obraId,
      status,
      processed,
      total,
      lastError: s.last_error || null,
      updatedAt: s.updated_date || s.created_date || new Date().toISOString(),
    });
  } catch (error) {
    console.error('[getConsolidacaoStatus] Erro:', error.message);
    return Response.json({
      ok: false, error: error.message, code: 'INTERNAL_ERROR',
      status: 'error', processed: 0, total: 0,
      lastError: error.message, updatedAt: new Date().toISOString(),
    }, { status: 200 });
  }
});