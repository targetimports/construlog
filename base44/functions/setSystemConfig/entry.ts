import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'SYSCFG-SET-' + Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode mudar config
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const updates = body.updates || {};

    // Atualizar ConfiguracaoSistema
    const keysToUpdate = [
      'system_mode',
      'safe_mode_reason',
      'safe_mode_auto',
      'circuit_breaker_enabled',
      'flags_modulos'
    ];

    let updated = 0;
    for (const key of keysToUpdate) {
      if (key in updates) {
        let value = updates[key];
        
        // Converter flags_modulos pra JSON se for objeto
        if (key === 'flags_modulos' && typeof value === 'object') {
          value = JSON.stringify(value);
        }

        // Buscar registro existente
        try {
          const existing = await base44.asServiceRole.entities.ConfiguracaoSistema.filter(
            { chave: key },
            undefined,
            1
          );

          if (existing && existing.length > 0) {
            // Update
            await base44.asServiceRole.entities.ConfiguracaoSistema.update(
              existing[0].id,
              { valor: String(value) }
            );
          } else {
            // Create
            await base44.asServiceRole.entities.ConfiguracaoSistema.create({
              chave: key,
              valor: String(value)
            });
          }
          updated++;
        } catch (e) {
          // ignore individual errors, continue
        }
      }
    }

    // Criar HealthCheck de auditoria config_change
    try {
      await base44.asServiceRole.entities.HealthCheck.create({
        tipo: 'config_change',
        status: 'ok',
        origem: 'runtime',
        codigo: 'SYSCFG_UPDATE',
        erro: null,
        contexto: {
          user_email: user.email,
          updates: Object.keys(updates),
          timestamp: new Date().toISOString()
        },
        detalhes: updates
      });
    } catch (e) {
      // ignore audit error
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      updated_keys: updated,
      changes: Object.keys(updates)
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});