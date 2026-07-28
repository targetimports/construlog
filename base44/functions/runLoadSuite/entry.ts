import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função interna para execução direta (sem invoke)
export async function runInternal(base44, params = {}) {
  const startTime = Date.now();
  const buildId = `QA-LOAD-${Date.now()}`;
  const metrics = {
    getKpisObraPlanejadoReal: { calls: 0, sum_ms: 0, times: [], errors: 0 },
    getDreObra: { calls: 0, sum_ms: 0, times: [], errors: 0 },
    getAlertasExecutivos: { calls: 0, sum_ms: 0, times: [], errors: 0 },
  };
  const notes = [];

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const loops = body.loops || 10;
    const concurrency = Math.min(body.concurrency || 1, 3);
    const obra_ids_max = body.obra_ids_max || 5;

    // Buscar obras para testar
    const obras = await base44.asServiceRole.entities.Obra.list(undefined, obra_ids_max);
    if (!obras || obras.length === 0) {
      notes.push('Nenhuma obra encontrada para teste de carga');
      return Response.json({
        ok: false,
        build_id: buildId,
        duration_ms: Date.now() - startTime,
        metrics,
        notes,
      });
    }

    // Rodar loops
    for (let i = 0; i < loops; i++) {
      for (const obra of obras) {
        // getKpisObraPlanejadoReal
        {
          const start = performance.now();
          try {
            const response = await base44.functions.invoke('getKpisObraPlanejadoReal', {
              obra_id: obra.id,
            });
            const ms = Math.round(performance.now() - start);
            metrics.getKpisObraPlanejadoReal.calls++;
            metrics.getKpisObraPlanejadoReal.sum_ms += ms;
            metrics.getKpisObraPlanejadoReal.times.push(ms);
          } catch (e) {
            metrics.getKpisObraPlanejadoReal.errors++;
          }
        }

        // getDreObra
        {
          const start = performance.now();
          try {
            const response = await base44.functions.invoke('getDreObra', {
              obra_id: obra.id,
              de: '2026-01-01',
              ate: '2026-12-31',
            });
            const ms = Math.round(performance.now() - start);
            metrics.getDreObra.calls++;
            metrics.getDreObra.sum_ms += ms;
            metrics.getDreObra.times.push(ms);
          } catch (e) {
            metrics.getDreObra.errors++;
          }
        }

        // getAlertasExecutivos (rodá 1x por loop, não por obra)
        if (i === 0) {
          const start = performance.now();
          try {
            const response = await base44.functions.invoke('getAlertasExecutivos', {});
            const ms = Math.round(performance.now() - start);
            metrics.getAlertasExecutivos.calls++;
            metrics.getAlertasExecutivos.sum_ms += ms;
            metrics.getAlertasExecutivos.times.push(ms);
          } catch (e) {
            metrics.getAlertasExecutivos.errors++;
          }
        }
      }
    }

    // Calcular estatísticas
    for (const key of Object.keys(metrics)) {
      if (metrics[key].times.length > 0) {
        const times = metrics[key].times.sort((a, b) => a - b);
        metrics[key].avg_ms = Math.round(metrics[key].sum_ms / metrics[key].calls);
        metrics[key].p95_ms = times[Math.floor(times.length * 0.95)];
        metrics[key].min_ms = times[0];
        metrics[key].max_ms = times[times.length - 1];
        delete metrics[key].times;
        delete metrics[key].sum_ms;

        if (metrics[key].avg_ms > 2000) {
          notes.push(`⚠️ ${key} lento: avg=${metrics[key].avg_ms}ms`);
        }
      }
    }

    notes.push(`Loops=${loops}, Concurrency=${concurrency}, Obras=${obras.length}`);

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }

  return {
    ok: true,
    build_id: buildId,
    duration_ms: Date.now() - startTime,
    metrics,
    notes,
  };
}

// Entrada HTTP padrão
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json().catch(() => ({}));
    const result = await runInternal(base44, body);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});