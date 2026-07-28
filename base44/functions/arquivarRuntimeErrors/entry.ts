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
      test_run_id = null,
      older_than_minutes = null,
      include_test = true
    } = body;

    if (!test_run_id && !older_than_minutes) {
      return Response.json({ error: 'Forneça test_run_id ou older_than_minutes' }, { status: 400 });
    }

    // Buscar erros para arquivar
    let query = { tipo: 'runtime_error', archived: false };
    
    const allErrors = await base44.asServiceRole.entities.HealthCheck.filter(
      query,
      '-created_date',
      1000
    );

    if (!allErrors || !Array.isArray(allErrors)) {
      return Response.json({ ok: true, archived_count: 0, criteria: { test_run_id, older_than_minutes, include_test } });
    }

    // Filtrar quais arquivar
    const toArchive = [];
    const cutoffDate = older_than_minutes ? new Date(Date.now() - (older_than_minutes * 60 * 1000)) : null;

    for (const err of allErrors) {
      let shouldArchive = false;

      // Se test_run_id especificado, arquivar erros desse run
      if (test_run_id) {
        try {
          const ctx = err.contexto;
          if (typeof ctx === 'object' && ctx && ctx.test_run_id === test_run_id) {
            shouldArchive = true;
          } else if (typeof ctx === 'string') {
            const parsed = JSON.parse(ctx);
            if (parsed.test_run_id === test_run_id) {
              shouldArchive = true;
            }
          }
        } catch {
          // ignore
        }
      }

      // Se older_than_minutes especificado, arquivar erros antigos
      if (older_than_minutes && cutoffDate) {
        try {
          const eTime = new Date(err.created_date);
          if (eTime < cutoffDate) {
            shouldArchive = true;
          }
        } catch {
          // ignore
        }
      }

      // Respeitar include_test
      if (!include_test && err.is_test) {
        shouldArchive = false;
      }

      if (shouldArchive) {
        toArchive.push(err);
      }
    }

    // Arquivar (atualizar com archived=true, archived_at, archived_by)
    const nowIso = new Date().toISOString();
    let archivedCount = 0;

    for (const err of toArchive) {
      try {
        await base44.asServiceRole.entities.HealthCheck.update(err.id, {
          archived: true,
          archived_at: nowIso,
          archived_by: user.email || 'system'
        });
        archivedCount++;
      } catch (e) {
        // log mas continua
      }
    }

    return Response.json({
      ok: true,
      archived_count: archivedCount,
      criteria: {
        test_run_id,
        older_than_minutes,
        include_test,
        archived_at: nowIso
      }
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});