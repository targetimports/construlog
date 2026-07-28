import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'PROMPT15-2026-02-14-HEALTH';
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parâmetros opcionais
    const body = await req.json().catch(() => ({}));
    const includeTest = body.include_test || false;
    const includeArchived = body.include_archived || false;
    const testRunId = body.test_run_id || null;

    // ========== THRESHOLDS (com fallback) ==========
    let thresholds = {
      window_minutes: 60,
      warn_errors: 3,
      critical_errors: 8
    };

    try {
      const config = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      if (config && Array.isArray(config)) {
        const map = {};
        config.forEach(c => { map[c.chave] = c.valor; });
        if (map['health_window_minutes']) thresholds.window_minutes = parseInt(map['health_window_minutes']) || 60;
        if (map['health_warn_errors']) thresholds.warn_errors = parseInt(map['health_warn_errors']) || 3;
        if (map['health_critical_errors']) thresholds.critical_errors = parseInt(map['health_critical_errors']) || 8;
      }
    } catch (e) {
      // use fallback
    }

    // ========== QA GATE (último) ==========
    let qaGateStatus = 'not_run';
    let lastQaBuild = null;
    try {
      const qaChecks = await base44.asServiceRole.entities.HealthCheck.filter({ tipo: 'qa_gate' }, '-created_date', 1);
      if (qaChecks && qaChecks.length > 0) {
        qaGateStatus = qaChecks[0].detalhes?.qa_gate_status || 'unknown';
        lastQaBuild = qaChecks[0].build_id;
      }
    } catch (e) {
      // ignore
    }

    // ========== RUNTIME ERRORS (últimos X minutos) ==========
    let runtimeErrorsRecent = 0;
    let runtimeCriticalRecent = 0;
    let runtimeHealth = 'ok';
    const nowIso = new Date().toISOString();
    const windowStartDate = new Date(Date.now() - (thresholds.window_minutes * 60 * 1000));
    const windowStartIso = windowStartDate.toISOString();

    try {
      const runtimeErrors = await base44.asServiceRole.entities.HealthCheck.filter(
        { tipo: 'runtime_error' },
        '-created_date',
        100
      );

      if (runtimeErrors && Array.isArray(runtimeErrors)) {
        // Filtrar por janela de tempo e aplicar filtros is_test/archived
        const recentErrors = runtimeErrors.filter(e => {
          // Validar data
          if (!e.created_date) return false;
          try {
            const eTime = new Date(e.created_date);
            if (isNaN(eTime.getTime())) return false;
            if (eTime < windowStartDate) return false; // Fora da janela
          } catch {
            return false;
          }

          // Aplicar filtro is_test (por padrão ignora testes)
          if (!includeTest && e.is_test) return false;

          // Aplicar filtro archived (por padrão ignora arquivados)
          if (!includeArchived && e.archived) return false;

          // Se mode teste com test_run_id, filtrar pelo test_run_id
          if (testRunId) {
            try {
              const ctx = e.contexto;
              if (typeof ctx === 'object' && ctx && ctx.test_run_id === testRunId) {
                return true;
              }
              if (typeof ctx === 'string') {
                const parsed = JSON.parse(ctx);
                if (parsed.test_run_id === testRunId) {
                  return true;
                }
              }
              return false;
            } catch {
              return false;
            }
          }

          return true;
        });

        runtimeErrorsRecent = recentErrors.length;
        runtimeCriticalRecent = recentErrors.filter(e => e.severidade === 'critical').length;
      }

      // Determinar runtime_health baseado em thresholds
      if (runtimeCriticalRecent > 0 || runtimeErrorsRecent >= thresholds.critical_errors) {
        runtimeHealth = 'critical';
      } else if (runtimeErrorsRecent >= thresholds.warn_errors) {
        runtimeHealth = 'warn';
      } else {
        runtimeHealth = 'ok';
      }
    } catch (e) {
      // ignore
    }

    // ========== STATUS GERAL ==========
    let overallStatus = 'ok';
    if (runtimeHealth === 'critical' || qaGateStatus === 'FAIL' || qaGateStatus === 'BLOCKED') {
      overallStatus = 'critical';
    } else if (runtimeHealth === 'warn') {
      overallStatus = 'warning';
    }

    const durationMs = Date.now() - startTime;

    return Response.json({
      ok: true,
      build_id: buildId,
      status: overallStatus,
      qa_gate: qaGateStatus,
      runtime_health: runtimeHealth,
      erros_recentes: runtimeErrorsRecent,
      runtime_critical_recent: runtimeCriticalRecent,
      thresholds: thresholds,
      last_qa_build: lastQaBuild,
      include_test: includeTest,
      include_archived: includeArchived,
      test_run_id_used: testRunId,
      now_iso: nowIso,
      window_start_iso: windowStartIso,
      duracao_ms: durationMs
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});