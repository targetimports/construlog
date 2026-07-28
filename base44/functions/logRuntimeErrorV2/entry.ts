import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'RUNTIMELOG-' + Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { severidade = 'warn', codigo, erro, contexto = {}, is_test = false, test_run_id = null } = body;

    // Determinar is_test automaticamente se houver test_run_id
    const finalIsTest = is_test || !!test_run_id;

    // Preservar test_run_id no contexto se fornecido
    const contextWithTestId = {
      ...(typeof contexto === 'object' ? contexto : {}),
      ...(test_run_id ? { test_run_id } : {})
    };

    const healthCheck = await base44.asServiceRole.entities.HealthCheck.create({
      tipo: 'runtime_error',
      status: 'ok',
      severidade,
      origem: 'runtime',
      codigo: codigo || 'RUNTIME_ERROR',
      erro: erro || 'Runtime error logged',
      contexto: contextWithTestId,
      build_id: buildId,
      is_test: finalIsTest,
      test_run_id: test_run_id || null,
      archived: false
    });

    return Response.json({ ok: true, id: healthCheck.id, build_id: buildId });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});