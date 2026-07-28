import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const codigo = body.codigo || 'UNKNOWN';
    const mensagem = body.mensagem || '';
    const severidade = body.severidade || 'warn';
    const contexto = body.contexto || {};

    const buildId = `RUNTIME-${Date.now()}`;

    // Persistir em HealthCheck
    const healthCheck = await base44.asServiceRole.entities.HealthCheck.create({
      tipo: 'runtime_error',
      severidade: severidade,
      status: severidade === 'critical' ? 'critical' : 'warning',
      codigo: codigo,
      erro: mensagem,
      contexto: contexto,
      build_id: buildId
    });

    return Response.json({
      ok: true,
      id: healthCheck.id,
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});