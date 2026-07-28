import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Fetch all outbox items
    const allItems = await base44.asServiceRole.entities.OpsOutbox.list('-created_date', 1000);

    // Count by status
    const statusCounts = {
      queued: 0,
      sent: 0,
      failed: 0,
      deadletter: 0,
      archived: 0
    };

    const latencies = [];
    const errors = [];
    let oldestQueuedMs = 0;

    allItems.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;

      if (item.last_latency_ms) {
        latencies.push(item.last_latency_ms);
      }

      if (item.last_error) {
        errors.push(item.last_error);
      }

      // Backlog age
      if (item.status === 'queued' && item.created_at_iso) {
        const ageMs = Date.now() - new Date(item.created_at_iso).getTime();
        if (ageMs > oldestQueuedMs) oldestQueuedMs = ageMs;
      }
    });

    // P95 latency
    let p95 = null;
    if (latencies.length > 0) {
      const sorted = latencies.sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * 0.95);
      p95 = sorted[idx];
    }

    // Top errors
    const errorCounts = {};
    errors.forEach(err => {
      const key = err.substring(0, 50);
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([err, count]) => ({ error: err, count }));

    // Circuit breaker status
    const config = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'ops_outbox_cb_state'
    });

    const cbState = config.length > 0 ? config[0].valor : 'closed';

    return Response.json({
      ok: true,
      build_id: `OUTBOX-METRICS-${Date.now()}`,
      timestamp: new Date().toISOString(),
      counts: statusCounts,
      queue_depth: statusCounts.queued,
      backlog_oldest_ms: oldestQueuedMs,
      latency: {
        avg_ms: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
        p95_ms: p95,
        samples: latencies.length
      },
      errors: {
        top: topErrors,
        total_unique: Object.keys(errorCounts).length
      },
      circuit_breaker: {
        state: cbState,
        enabled: true
      },
      total_items: allItems.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});