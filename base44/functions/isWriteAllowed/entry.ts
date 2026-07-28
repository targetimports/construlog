import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'WRITECHECK-' + Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { feature = 'general', action = 'write' } = body;

    // ========== 1. Ler ConfiguracaoSistema ==========
    let config = {};
    try {
      const records = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      if (records && Array.isArray(records)) {
        records.forEach(r => {
          config[r.chave] = r.valor;
        });
      }
    } catch (e) {
      // vazio
    }

    // Defaults
    const system_mode = config.system_mode || 'staging';
    const circuit_breaker_enabled = (config.circuit_breaker_enabled !== 'false' && config.circuit_breaker_enabled !== false && config.circuit_breaker_enabled !== '0' && config.circuit_breaker_enabled !== 0) && config.circuit_breaker_enabled !== null;
    let flags_modulos = {};
    try {
      flags_modulos = typeof config.flags_modulos === 'string' 
        ? JSON.parse(config.flags_modulos)
        : config.flags_modulos || {};
    } catch {
      flags_modulos = {};
    }

    // ========== 2. Check Safe Mode ==========
    if (system_mode === 'safe') {
      return Response.json({
        ok: true,
        allowed: false,
        reason: 'SAFE_MODE',
        system_mode,
        runtime_health: 'unknown',
        feature_enabled: flags_modulos[feature] !== false
      });
    }

    // ========== 3. Check Circuit Breaker ==========
    let runtime_health = 'ok';
    if (circuit_breaker_enabled) {
      try {
        // Ler últimos runtime_error
        const runtimeErrors = await base44.asServiceRole.entities.HealthCheck.filter(
          { tipo: 'runtime_error', archived: false, is_test: false },
          '-created_date',
          100
        );

        // Calcular saúde (últimos 60 min)
        const windowMs = 60 * 60 * 1000;
        const now = Date.now();
        const recentErrors = (runtimeErrors || []).filter(e => {
          try {
            const eTime = new Date(e.created_date).getTime();
            return (now - eTime) <= windowMs;
          } catch {
            return false;
          }
        });

        const criticalCount = recentErrors.filter(e => e.severidade === 'critical').length;
        const errorThreshold = 8; // thresholds.critical_errors

        if (criticalCount > 0 || recentErrors.length >= errorThreshold) {
          runtime_health = 'critical';
        } else if (recentErrors.length >= 3) {
          runtime_health = 'warn';
        } else {
          runtime_health = 'ok';
        }

        // Se circuit breaker ON e runtime critical => block
        if (runtime_health === 'critical') {
          return Response.json({
            ok: true,
            allowed: false,
            reason: 'CIRCUIT_BREAKER',
            system_mode,
            runtime_health,
            feature_enabled: flags_modulos[feature] !== false
          });
        }
      } catch (e) {
        // Se erro ao ler health, deixar passar (fail open)
      }
    }

    // ========== 4. Check Feature Flag ==========
    const featureEnabled = flags_modulos[feature] !== false; // default true
    if (!featureEnabled) {
      return Response.json({
        ok: true,
        allowed: false,
        reason: 'FEATURE_DISABLED',
        system_mode,
        runtime_health,
        feature_enabled: false
      });
    }

    // ========== 5. Write Allowed ==========
    return Response.json({
      ok: true,
      allowed: true,
      reason: 'OK',
      system_mode,
      runtime_health,
      feature_enabled: true
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});