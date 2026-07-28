import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { confirm } = body;

    if (confirm !== 'RESET') {
      return Response.json({ error: 'Confirmação obrigatória: confirm=RESET' }, { status: 400 });
    }

    // Reset circuit breaker state
    const cbStateConfigs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'ops_outbox_cb_state'
    });

    if (cbStateConfigs.length > 0) {
      await base44.asServiceRole.entities.ConfiguracaoSistema.update(cbStateConfigs[0].id, {
        valor: 'closed'
      });
    } else {
      await base44.asServiceRole.entities.ConfiguracaoSistema.create({
        chave: 'ops_outbox_cb_state',
        valor: 'closed'
      });
    }

    // Reset failure counters
    const failureConfigs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'ops_outbox_consecutive_failures'
    });

    if (failureConfigs.length > 0) {
      await base44.asServiceRole.entities.ConfiguracaoSistema.update(failureConfigs[0].id, {
        valor: '0'
      });
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'RESET_CIRCUIT_BREAKER',
      modulo: 'ops',
      entidade: 'OpsOutbox',
      sucesso: true,
      detalhes: 'Circuit breaker resetado para closed, failures=0'
    });

    return Response.json({
      ok: true,
      build_id: `CB-RESET-${Date.now()}`,
      cb_state: 'closed',
      consecutive_failures: 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});