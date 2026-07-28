import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Automação de entidade: dispara ao atualizar um BM.
 * Quando status muda para APROVADA ou RETIFICADA, recalcula o BM atual + todos os futuros.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data, old_data } = payload;

    if (event?.type !== 'update') {
      return Response.json({ skipped: true });
    }

    // Só disparar quando status muda para APROVADA ou RETIFICADA
    const statusRelevante = ['APROVADA', 'RETIFICADA'].includes(data?.status);
    const statusMudou = old_data?.status !== data?.status;
    if (!statusRelevante || !statusMudou) {
      return Response.json({ skipped: true, reason: 'Status não relevante ou não mudou' });
    }

    if (!data?.id) {
      return Response.json({ skipped: true, reason: 'Sem id do BM' });
    }

    const { data: result } = await base44.asServiceRole.functions.invoke('recalcBMsFuture', { bm_id: data.id });
    return Response.json({ success: true, ...result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});