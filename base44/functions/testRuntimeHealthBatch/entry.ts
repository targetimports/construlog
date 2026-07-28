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
      count = 1,
      severidade = 'warn',
      test_run_id: inputTestRunId = null
    } = body;

    // Gerar test_run_id único se não fornecido
    const testRunId = inputTestRunId || `T-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const results = [];
    let created = 0;

    for (let i = 0; i < count; i++) {
      try {
        const healthCheck = await base44.asServiceRole.entities.HealthCheck.create({
          tipo: 'runtime_error',
          status: 'ok',
          severidade,
          origem: 'runtime',
          codigo: `TEST_${severidade.toUpperCase()}`,
          erro: `Test error #${i + 1}`,
          contexto: {
            test_run_id: testRunId,
            test_index: i + 1
          },
          build_id: `TEST-BATCH-${Date.now()}`,
          is_test: true,
          test_run_id: testRunId,
          archived: false
        });
        results.push({ ok: true, id: healthCheck.id });
        created++;
      } catch (e) {
        results.push({ ok: false, error: e.message });
      }
    }

    return Response.json({
      ok: true,
      test_run_id: testRunId,
      severidade,
      count,
      created,
      results
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});