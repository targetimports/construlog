import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'SYSCFG-GET-' + Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ler ConfiguracaoSistema
    let config = {};
    try {
      const records = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      if (records && Array.isArray(records)) {
        records.forEach(r => {
          config[r.chave] = r.valor;
        });
      }
    } catch (e) {
      // ConfiguracaoSistema não existe ou vazio
    }

    // Defaults
    const defaults = {
      system_mode: 'staging',
      safe_mode_reason: '',
      safe_mode_auto: false,
      circuit_breaker_enabled: true,
      flags_modulos: JSON.stringify({
        compras: true,
        financeiro: true,
        estoque: true,
        bi: true,
        rh: true,
        agenda: true,
        producao: true
      })
    };

    // Merge config com defaults
    const result = { ...defaults };
    Object.keys(config).forEach(key => {
      if (config[key] !== undefined) result[key] = config[key];
    });

    // Parse flags_modulos se for string
    if (typeof result.flags_modulos === 'string') {
      try {
        result.flags_modulos = JSON.parse(result.flags_modulos);
      } catch {
        result.flags_modulos = defaults.flags_modulos;
      }
    }

    // safe_mode_auto
    if (typeof result.safe_mode_auto === 'string') {
      result.safe_mode_auto = result.safe_mode_auto === 'true' || result.safe_mode_auto === '1';
    }

    // circuit_breaker_enabled
    if (typeof result.circuit_breaker_enabled === 'string') {
      result.circuit_breaker_enabled = result.circuit_breaker_enabled === 'true' || result.circuit_breaker_enabled === '1';
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      config: result,
      duracao_ms: 0
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});