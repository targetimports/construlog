import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `QAGATE-INLINE-${Date.now()}`;
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const regression = { ran: false, passed: 0, failed: 0, ms: 0, errors: [], tests: [] };
    const load = { ran: false, avg_ms: 0, p95_ms: 0, samples: 0, errors: [], metrics: {} };
    let overallStatus = 'BLOCKED';
    let recommendation = 'BLOCK_PROD';

    // ========== REGRESSÃO INLINE ==========
    const regressionStartTime = Date.now();
    const regressionTests = [];
    let regressionPassed = 0;
    let regressionFailed = 0;

    try {
      // T01: Obras (leitura)
      {
        const start = performance.now();
        try {
          const obras = await base44.asServiceRole.entities.Obra.list(undefined, 3);
          const ok = obras && obras.length > 0 && obras[0].id && obras[0].nome;
          const ms = Math.round(performance.now() - start);
          if (ok) {
            regressionPassed++;
            regressionTests.push({ id: 'T01', name: 'Obras: leitura', ok: true, ms, evidence: `${obras.length} obras` });
          } else {
            regressionFailed++;
            regressionTests.push({ id: 'T01', name: 'Obras: leitura', ok: false, ms, error: 'campos ausentes' });
          }
        } catch (e) {
          regressionFailed++;
          regressionTests.push({ id: 'T01', name: 'Obras: leitura', ok: false, ms: 0, error: e.message });
        }
      }

      // T02: Compras (criar OC)
      {
        const start = performance.now();
        try {
          const fornecedores = await base44.asServiceRole.entities.Fornecedor.list(undefined, 1);
          if (!fornecedores || fornecedores.length === 0) {
            regressionFailed++;
            regressionTests.push({ id: 'T02', name: 'Compras: criar OC', ok: false, ms: Math.round(performance.now() - start), error: 'sem fornecedor' });
          } else {
            const testOC = {
              numero: `QA-GATE-OC-${buildId}`,
              fornecedor_id: fornecedores[0].id,
              valor_total: 1000,
              empresa_id: 'qa-test',
              itens: [],
              data_emissao: new Date().toISOString().split('T')[0],
            };
            const oc = await base44.asServiceRole.entities.OrdemCompra.create(testOC);
            const ms = Math.round(performance.now() - start);
            regressionPassed++;
            regressionTests.push({ id: 'T02', name: 'Compras: criar OC', ok: true, ms, evidence: `OC ${oc.id}` });
          }
        } catch (e) {
          regressionFailed++;
          regressionTests.push({ id: 'T02', name: 'Compras: criar OC', ok: false, ms: Math.round(performance.now() - start), error: e.message });
        }
      }

      // T06: Diário (criar)
      {
        const start = performance.now();
        try {
          const obras = await base44.asServiceRole.entities.Obra.list(undefined, 1);
          if (obras && obras.length > 0) {
            const diario = await base44.asServiceRole.entities.DiarioObra.create({
              obra_id: obras[0].id,
              data: new Date().toISOString().split('T')[0],
              mao_obra: [],
              is_test: true,
            });
            const ms = Math.round(performance.now() - start);
            regressionPassed++;
            regressionTests.push({ id: 'T06', name: 'Diário: criar', ok: true, ms, evidence: `${diario.id}` });
          } else {
            regressionFailed++;
            regressionTests.push({ id: 'T06', name: 'Diário: criar', ok: false, ms: Math.round(performance.now() - start), error: 'sem obra' });
          }
        } catch (e) {
          regressionFailed++;
          regressionTests.push({ id: 'T06', name: 'Diário: criar', ok: false, ms: Math.round(performance.now() - start), error: e.message });
        }
      }

      regression.ran = true;
      regression.passed = regressionPassed;
      regression.failed = regressionFailed;
      regression.ms = Date.now() - regressionStartTime;
      regression.tests = regressionTests;

      // PASS se T01, T02, T06 ALL ok=true (3/3 essenciais)
      const essentialTests = regressionTests.filter(t => ['T01', 'T02', 'T06'].includes(t.id));
      const essentialPass = essentialTests.every(t => t.ok === true);

      if (essentialPass && regressionFailed === 0) {
        overallStatus = 'PASS';
        recommendation = 'ALLOW_PROD';
      } else {
        overallStatus = 'FAIL';
        recommendation = 'BLOCK_PROD';
        if (regressionFailed > 0) {
          regression.errors.push(`${regressionFailed} critical tests failed`);
        }
      }
    } catch (e) {
      regression.errors.push(e.message);
      overallStatus = 'FAIL';
      recommendation = 'BLOCK_PROD';
    }

    // ========== LOAD INLINE (somente se PASS) ==========
    if (overallStatus === 'PASS') {
      const loadStartTime = Date.now();
      const metrics = {};
      const metricsSamples = [];

      try {
        // Medir ContaFinanceira
        {
          const samples = [];
          for (let i = 0; i < 3; i++) {
            const start = performance.now();
            try {
              await base44.asServiceRole.entities.ContaFinanceira.list(undefined, 10);
              samples.push(Math.round(performance.now() - start));
            } catch (e) {
              // skip
            }
          }
          if (samples.length > 0) {
            const sorted = samples.sort((a, b) => a - b);
            const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
            const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0;
            metrics.ContaFinanceira = { avg_ms: avg, p95_ms: p95, samples: samples.length };
            metricsSamples.push(...samples);
          }
        }

        // Medir MovimentacaoEstoque
        {
          const samples = [];
          for (let i = 0; i < 3; i++) {
            const start = performance.now();
            try {
              await base44.asServiceRole.entities.MovimentacaoEstoque.list(undefined, 10);
              samples.push(Math.round(performance.now() - start));
            } catch (e) {
              // skip
            }
          }
          if (samples.length > 0) {
            const sorted = samples.sort((a, b) => a - b);
            const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
            const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0;
            metrics.MovimentacaoEstoque = { avg_ms: avg, p95_ms: p95, samples: samples.length };
            metricsSamples.push(...samples);
          }
        }

        // Medir LogAuditoria
        {
          const samples = [];
          for (let i = 0; i < 3; i++) {
            const start = performance.now();
            try {
              await base44.asServiceRole.entities.LogAuditoria.list(undefined, 10);
              samples.push(Math.round(performance.now() - start));
            } catch (e) {
              // skip
            }
          }
          if (samples.length > 0) {
            const sorted = samples.sort((a, b) => a - b);
            const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
            const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0;
            metrics.LogAuditoria = { avg_ms: avg, p95_ms: p95, samples: samples.length };
            metricsSamples.push(...samples);
          }
        }

        load.ran = true;
        load.metrics = metrics;
        load.samples = metricsSamples.length;

        if (metricsSamples.length > 0) {
          const allMs = metricsSamples.sort((a, b) => a - b);
          load.avg_ms = Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length);
          load.p95_ms = allMs[Math.ceil(allMs.length * 0.95) - 1] || 0;
        } else {
          load.errors.push('No load samples collected');
        }
      } catch (e) {
        load.errors.push(e.message);
      }
    }

    // ========== PERSIST HealthCheck ==========
    try {
      await base44.asServiceRole.entities.HealthCheck.create({
        tipo: 'qa_gate',
        status: overallStatus === 'PASS' ? 'ok' : 'critical',
        detalhes: {
          qa_gate_status: overallStatus,
          recommendation: recommendation,
          regression: regression,
          load: load
        },
        duracao_ms: Date.now() - startTime,
        build_id: buildId
      });
    } catch (e) {
      // ignore persist error
    }

    return Response.json({
      ok: overallStatus === 'PASS',
      build_id: buildId,
      status: overallStatus,
      recommendation: recommendation,
      regression: regression,
      load: load,
      duracao_ms: Date.now() - startTime
    });

  } catch (e) {
    return Response.json({ 
      ok: false, 
      build_id: buildId, 
      status: 'BLOCKED',
      error: e.message 
    }, { status: 500 });
  }
});