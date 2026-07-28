import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { recalcBMsFuture } from './_lib/recalcBMsFuture.js';

/**
 * Automação de entidade: dispara ao criar/atualizar um BMItem.
 * Recalcula o BM atual + todos os BMs futuros quando qtd_periodo_input ou override_manual mudam.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data, old_data } = payload;

    if (!['create', 'update'].includes(event?.type)) {
      return Response.json({ skipped: true });
    }

    // Para update: só recalcular se qtd_periodo_input ou override_manual mudaram
    if (event.type === 'update' && old_data) {
      const mudou = old_data.qtd_periodo_input !== data.qtd_periodo_input ||
                    old_data.override_manual   !== data.override_manual;
      if (!mudou) {
        return Response.json({ skipped: true, reason: 'Nenhum campo relevante alterado' });
      }
    }

    if (!data?.bm_id) {
      return Response.json({ skipped: true, reason: 'Sem bm_id' });
    }

    const result = await recalcBMsFuture(base44.asServiceRole, data.bm_id);
    return Response.json({ success: true, ...result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});