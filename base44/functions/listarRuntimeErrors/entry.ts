import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      minutes = 120,
      severidade = null,
      include_test = false,
      include_archived = false,
      limit = 20
    } = body;

    // Janela de tempo
    const windowStartDate = new Date(Date.now() - (minutes * 60 * 1000));
    const windowStartIso = windowStartDate.toISOString();

    // Buscar runtime errors
    const allErrors = await base44.asServiceRole.entities.HealthCheck.filter(
      { tipo: 'runtime_error' },
      '-created_date',
      100
    );

    if (!allErrors || !Array.isArray(allErrors)) {
      return Response.json({ ok: true, items: [], total: 0 });
    }

    // Filtrar conforme critérios
    const filtered = allErrors.filter(e => {
      // Validar data
      if (!e.created_date) return false;
      try {
        const eTime = new Date(e.created_date);
        if (isNaN(eTime.getTime())) return false;
        if (eTime < windowStartDate) return false;
      } catch {
        return false;
      }

      // Filtro is_test
      if (!include_test && e.is_test) return false;

      // Filtro archived
      if (!include_archived && e.archived) return false;

      // Filtro severidade
      if (severidade && e.severidade !== severidade) return false;

      return true;
    });

    // Aplicar limit
    const items = filtered.slice(0, limit);

    return Response.json({
      ok: true,
      items,
      total: filtered.length,
      criteria: {
        minutes,
        severidade,
        include_test,
        include_archived,
        limit,
        window_start_iso: windowStartIso
      }
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});