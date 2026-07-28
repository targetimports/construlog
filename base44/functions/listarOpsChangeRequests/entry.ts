import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `CR-LIST-${Date.now()}`;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { status, ambiente, tipo, limit = 50 } = body;

    // Construir filtro
    const filter = {};
    if (status) filter.status = status;
    if (ambiente) filter.ambiente = ambiente;
    if (tipo) filter.tipo = tipo;

    // Buscar CRs
    const crs = await base44.asServiceRole.entities.OpsChangeRequest.filter(
      filter,
      '-created_date',
      limit
    );

    // Contar por status
    const counts = {
      pending_approval: 0,
      approved: 0,
      executing: 0,
      success: 0,
      failed: 0,
      cancelled: 0,
      expired: 0,
      draft: 0
    };

    if (crs && Array.isArray(crs)) {
      crs.forEach(cr => {
        if (counts.hasOwnProperty(cr.status)) {
          counts[cr.status]++;
        }
      });
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      data: crs || [],
      counts,
      total: crs ? crs.length : 0
    });
  } catch (error) {
    console.error('Erro em listarOpsChangeRequests:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});