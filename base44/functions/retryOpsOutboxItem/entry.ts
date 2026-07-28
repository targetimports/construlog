import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `OUTBOX-RETRY-${Date.now()}`;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { outbox_id } = body;

  if (!outbox_id || typeof outbox_id !== 'string') {
    return Response.json({ error: 'outbox_id required', field: 'outbox_id' }, { status: 400 });
  }

  try {
    // Buscar item
    const items = await base44.asServiceRole.entities.OpsOutbox.filter(
      { id: outbox_id },
      undefined,
      1
    );

    if (!items || items.length === 0) {
      return Response.json({ error: 'Outbox item not found', field: 'outbox_id' }, { status: 404 });
    }

    const item = items[0];

    // Apenas deadletter ou failed
    if (!['deadletter', 'failed'].includes(item.status)) {
      return Response.json(
        { error: `Cannot retry status: ${item.status}`, reason: 'INVALID_STATUS' },
        { status: 409 }
      );
    }

    // Retry: volta queued, limpa last_error, preserva attempts
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.OpsOutbox.update(outbox_id, {
      status: 'queued',
      next_attempt_at: now,
      last_error: null,
      build_id: buildId
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'RETRY',
        modulo: 'ops',
        entidade: 'OpsOutbox',
        entidade_id: outbox_id,
        dados_anteriores: { status: item.status },
        dados_novos: { status: 'queued' },
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      outbox_id,
      status: 'queued',
      attempts: item.attempts || 0
    });
  } catch (error) {
    console.error('Erro em retryOpsOutboxItem:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});