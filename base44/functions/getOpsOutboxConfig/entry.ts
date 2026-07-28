import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `OUTBOX-CONFIG-GET-${Date.now()}`;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => {
        configMap[c.chave] = c.valor;
      });
    }

    // Extrair valores com defaults
    const webhook_url = configMap['ops_outbox_webhook_url'] || '';
    const has_secret_hash = !!configMap['ops_outbox_webhook_secret_hash'];
    const batch_size = parseInt(configMap['ops_outbox_batch_size'] || '20');
    const max_retries = parseInt(configMap['ops_outbox_max_retries'] || '5');
    const backoff_base_ms = parseInt(configMap['ops_outbox_backoff_base_ms'] || '3000');
    const timeout_ms = parseInt(configMap['ops_outbox_timeout_ms'] || '8000');
    const enabled = configMap['ops_outbox_enabled'] !== 'false';

    // Mascarar URL (mostrar só primeiro e último 5 chars)
    const webhook_url_masked = webhook_url
      ? webhook_url.substring(0, 5) + '...' + webhook_url.substring(webhook_url.length - 5)
      : '';

    return Response.json({
      ok: true,
      build_id: buildId,
      enabled,
      webhook_url_masked,
      has_secret_hash,
      batch_size,
      max_retries,
      backoff_base_ms,
      timeout_ms
    });
  } catch (error) {
    console.error('Erro em getOpsOutboxConfig:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});