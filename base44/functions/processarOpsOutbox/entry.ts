import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

// HMAC SHA256 helper
async function hmacSha256(message, key) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(message);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', importedKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const buildId = `OUTBOX-PROCESS-${Date.now()}`;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    limit,
    status: statusFilter = 'queued',
    dry_run = false,
    include_test = false,
    simulate_only = false,
    now_iso = new Date().toISOString()
  } = body;

  try {
    // Ler config
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => {
        configMap[c.chave] = c.valor;
      });
    }

    const enabled = configMap['ops_outbox_enabled'] !== 'false';
    if (!enabled) {
      return Response.json({
        ok: true,
        build_id: buildId,
        skipped_reason: 'DISABLED',
        processed_count: 0,
        sent_count: 0,
        queued_count: 0,
        deadletter_count: 0,
        skipped_count: 0
      });
    }

    const webhook_url = configMap['ops_outbox_webhook_url'] || '';
    const webhook_secret_hash = configMap['ops_outbox_webhook_secret_hash'] || '';
    const batch_size = parseInt(configMap['ops_outbox_batch_size'] || '20');
    const max_retries = parseInt(configMap['ops_outbox_max_retries'] || '5');
    const backoff_base_ms = parseInt(configMap['ops_outbox_backoff_base_ms'] || '3000');
    const timeout_ms = parseInt(configMap['ops_outbox_timeout_ms'] || '8000');
    const cb_enabled = configMap['ops_outbox_cb_enabled'] !== 'false';
    const cb_fail_threshold = parseInt(configMap['ops_outbox_cb_fail_threshold'] || '5');
    const cb_cooldown_minutes = parseInt(configMap['ops_outbox_cb_cooldown_minutes'] || '10');

    // Check circuit breaker
    let cbState = configMap['ops_outbox_cb_state'] || 'closed';
    const cbOpenedAt = configMap['ops_outbox_cb_opened_at'] ? new Date(configMap['ops_outbox_cb_opened_at']) : null;
    const now = new Date(now_iso);

    // Se CB aberto, verificar cooldown
    if (cb_enabled && cbState === 'open' && cbOpenedAt) {
      const cooldownExpiredAt = new Date(cbOpenedAt.getTime() + cb_cooldown_minutes * 60 * 1000);
      if (now >= cooldownExpiredAt) {
        cbState = 'half-open';
        await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
          chave: 'ops_outbox_cb_state'
        }).then(cfgs => {
          if (cfgs.length > 0) {
            return base44.asServiceRole.entities.ConfiguracaoSistema.update(cfgs[0].id, { valor: 'half-open' });
          }
        }).catch(() => {});
      }
    }

    // Listar itens a processar
    let items = await base44.asServiceRole.entities.OpsOutbox.filter(
      {
        status: statusFilter,
        archived: false
      },
      'created_at_iso',
      limit || batch_size
    );

    items = (items || []).filter(item => {
      // Filtrar por próxima tentativa se for retry
      if (item.next_attempt_at) {
        return new Date(item.next_attempt_at) <= now;
      }
      return true;
    });

    let sent_count = 0;
    let queued_count = 0;
    let deadletter_count = 0;
    let skipped_count = 0;
    const sample = [];

    for (const item of items) {
      try {
        // Check circuit breaker
        if (cb_enabled && (cbState === 'open' || (cbState === 'half-open' && Math.random() > 0.5))) {
          if (!dry_run) {
            await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
              circuit_breaker_blocked: true,
              build_id: buildId
            });
          }
          skipped_count++;
          continue;
        }

        // Preparar body
        const body = {
          tipo: item.tipo,
          outbox_id: item.id,
          payload: item.payload,
          created_at: item.created_at_iso
        };

        const bodyJson = JSON.stringify(body);
        const ts = now_iso;
        const msgToSign = `${ts}.${bodyJson}`;

        // Request hash para anti-replay
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(msgToSign));
        const requestHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Check anti-replay: se request_hash já existe e status=sent, skip
        if (item.request_hash === requestHash && item.status === 'sent') {
          if (!dry_run) {
            await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
              status: 'sent',
              build_id: buildId
            });
          }
          skipped_count++;
          continue;
        }

        // Gerar signature (usar secret hash como seed, nunca armazenar secret plain)
        let signature = '';
        let signatureTs = ts;

        if (webhook_secret_hash) {
          signature = await hmacSha256(msgToSign, webhook_secret_hash);
        }

        // Idempotency key e delivery ID
        const idempotencyKey = item.idempotency_key || item.id;
        const deliveryId = item.delivery_id || `dlv-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Preparar headers
        const headers = {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Delivery-Id': deliveryId
        };

        if (signature) {
          headers['X-Ops-Signature'] = `sha256=${signature}`;
          headers['X-Ops-Timestamp'] = signatureTs;
        }

        // Determinar se será enviado
        let wouldSend = false;
        let response = null;
        let responseStatus = 0;
        let responseBodyTrunc = '';
        let latencyMs = 0;

        // Mock mode
        if (webhook_url.startsWith('mock://')) {
          wouldSend = true;
          const start = Date.now();
          if (webhook_url === 'mock://success') {
            responseStatus = 200;
            responseBodyTrunc = 'OK';
          } else if (webhook_url === 'mock://fail:500') {
            responseStatus = 500;
            responseBodyTrunc = 'Server Error';
          } else if (webhook_url === 'mock://fail:429') {
            responseStatus = 429;
            responseBodyTrunc = 'Too Many Requests';
          }
          latencyMs = Date.now() - start + Math.random() * 50;
        } else if (webhook_url && item.channel === 'webhook') {
          wouldSend = true;
          if (!dry_run && !simulate_only) {
            try {
              const start = Date.now();
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeout_ms);

              response = await fetch(webhook_url, {
                method: 'POST',
                headers,
                body: bodyJson,
                signal: controller.signal
              });

              clearTimeout(timeoutId);
              latencyMs = Date.now() - start;

              responseStatus = response.status;
              const bodyText = await response.text();
              responseBodyTrunc = bodyText.substring(0, 800);
            } catch (e) {
              responseStatus = e.name === 'AbortError' ? 408 : 500;
              responseBodyTrunc = e.message.substring(0, 800);
              latencyMs = Date.now() - (start || Date.now());
            }
          }
        }

        // Lógica de atualização
        if (wouldSend) {
          const is2xx = responseStatus >= 200 && responseStatus < 300;

          if (is2xx || dry_run || simulate_only) {
            // Sucesso
            if (!dry_run) {
              await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
                status: 'sent',
                sent_at_iso: now.toISOString(),
                delivered_at: now.toISOString(),
                response_status: responseStatus,
                response_body_trunc: responseBodyTrunc,
                signature_sha256: signature,
                signature_ts: signatureTs,
                delivery_id: deliveryId,
                request_hash: requestHash,
                last_latency_ms: latencyMs,
                webhook_url_used: webhook_url,
                attempts: (item.attempts || 0) + 1,
                last_attempt_at: now.toISOString(),
                last_error: null,
                build_id: buildId
              });
              
              // Update CB metrics
              if (cbState !== 'closed') {
                const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
                  chave: 'ops_outbox_cb_state'
                });
                if (cfgs.length > 0) {
                  await base44.asServiceRole.entities.ConfiguracaoSistema.update(cfgs[0].id, { valor: 'closed' });
                }
                const failCfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
                  chave: 'ops_outbox_consecutive_failures'
                });
                if (failCfgs.length > 0) {
                  await base44.asServiceRole.entities.ConfiguracaoSistema.update(failCfgs[0].id, { valor: '0' });
                }
              }
            }
            sent_count++;
            sample.push({
              id: item.id,
              tipo: item.tipo,
              status: 'sent',
              attempts: (item.attempts || 0) + 1,
              latency_ms: latencyMs
            });
          } else {
            // Falha - retry ou deadletter ou CB open
            const newAttempts = (item.attempts || 0) + 1;
            const isDeadletter = newAttempts >= max_retries;

            const backoffMs = backoff_base_ms * Math.pow(2, Math.min(newAttempts - 1, 5)) + Math.random() * 1000;
            const nextAttemptAt = new Date(now.getTime() + backoffMs).toISOString();

            const newStatus = isDeadletter ? 'deadletter' : 'queued';

            if (!dry_run) {
              await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
                status: newStatus,
                response_status: responseStatus,
                response_body_trunc: responseBodyTrunc,
                signature_sha256: signature,
                signature_ts: signatureTs,
                delivery_id: deliveryId,
                request_hash: requestHash,
                last_latency_ms: latencyMs,
                webhook_url_used: webhook_url,
                attempts: newAttempts,
                last_attempt_at: now.toISOString(),
                next_attempt_at: isDeadletter ? null : nextAttemptAt,
                last_error: `HTTP ${responseStatus}: ${responseBodyTrunc}`.substring(0, 200),
                build_id: buildId
              });
              
              // Update CB metrics
              if (cb_enabled) {
                const failCfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
                  chave: 'ops_outbox_consecutive_failures'
                });
                const currentFailures = failCfgs.length > 0 ? parseInt(failCfgs[0].valor || '0') : 0;
                const newFailures = currentFailures + 1;
                
                if (failCfgs.length > 0) {
                  await base44.asServiceRole.entities.ConfiguracaoSistema.update(failCfgs[0].id, { valor: String(newFailures) });
                } else {
                  await base44.asServiceRole.entities.ConfiguracaoSistema.create({
                    chave: 'ops_outbox_consecutive_failures',
                    valor: String(newFailures)
                  });
                }
                
                if (newFailures >= cb_fail_threshold && cbState !== 'open') {
                  const cbCfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
                    chave: 'ops_outbox_cb_state'
                  });
                  if (cbCfgs.length > 0) {
                    await base44.asServiceRole.entities.ConfiguracaoSistema.update(cbCfgs[0].id, { valor: 'open' });
                  } else {
                    await base44.asServiceRole.entities.ConfiguracaoSistema.create({
                      chave: 'ops_outbox_cb_state',
                      valor: 'open'
                    });
                  }
                  const openCfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
                    chave: 'ops_outbox_cb_opened_at'
                  });
                  if (openCfgs.length > 0) {
                    await base44.asServiceRole.entities.ConfiguracaoSistema.update(openCfgs[0].id, { valor: now.toISOString() });
                  } else {
                    await base44.asServiceRole.entities.ConfiguracaoSistema.create({
                      chave: 'ops_outbox_cb_opened_at',
                      valor: now.toISOString()
                    });
                  }
                }
              }
            }

            if (isDeadletter) {
              deadletter_count++;
            } else {
              queued_count++;
            }

            sample.push({
              id: item.id,
              tipo: item.tipo,
              status: newStatus,
              attempts: newAttempts,
              next_attempt_in_ms: isDeadletter ? null : backoffMs,
              latency_ms: latencyMs
            });
          }
        } else {
          // Não foi enviado (UI ou webhook sem URL)
          if (!dry_run) {
            await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
              status: 'queued',
              build_id: buildId
            });
          }
          skipped_count++;
        }
      } catch (e) {
        console.error('Erro ao processar item:', e.message);
        if (!dry_run) {
          try {
            await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
              status: 'failed',
              last_error: e.message.substring(0, 200),
              attempts: (item.attempts || 0) + 1,
              last_attempt_at: now.toISOString(),
              build_id: buildId
            });
          } catch (e2) {
            console.error('Erro ao atualizar failed:', e2.message);
          }
        }
        deadletter_count++;
      }
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      processed_count: items.length,
      sent_count,
      queued_count,
      deadletter_count,
      skipped_count,
      dry_run,
      webhook_configured: !!webhook_url,
      sample: sample.slice(0, 5)
    });
  } catch (error) {
    console.error('Erro em processarOpsOutbox:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});