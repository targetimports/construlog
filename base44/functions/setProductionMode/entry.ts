import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'PROMPT13-2026-02-14-F';
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'staging';
    const require_qa_pass = body.require_qa_pass !== false;

    let persisted = 'NONE';
    let qaStatus = 'not_checked';

    // Se production, OBRIGATÓRIO validar QA Gate
    if (mode === 'production' && require_qa_pass) {
      try {
        // Buscar último HealthCheck de qa_gate
        const qaChecks = await base44.asServiceRole.entities.HealthCheck.filter({ tipo: 'qa_gate' }, '-created_date', 1);
        if (qaChecks && qaChecks.length > 0) {
          const lastQa = qaChecks[0];
          qaStatus = lastQa.detalhes?.qa_gate_status || 'UNKNOWN';
          
          // BLOCK se não PASS
          if (qaStatus !== 'PASS') {
            return Response.json({
              ok: false,
              build_id: buildId,
              error: 'QA_GATE_BLOCK',
              qa_status: qaStatus,
              recommendation: lastQa.detalhes?.recommendation || 'BLOCK_PROD'
            }, { status: 403 });
          }
        } else {
          // Nenhum QA executado
          return Response.json({
            ok: false,
            build_id: buildId,
            error: 'QA_GATE_NOT_RUN',
            qa_status: 'NOT_RUN'
          }, { status: 403 });
        }
      } catch (e) {
        return Response.json({
          ok: false,
          build_id: buildId,
          error: 'QA_GATE_VALIDATION_FAILED',
          qa_error: e.message
        }, { status: 500 });
      }
    }

    // Persistir configuração em ConfiguracaoSistema
    const configs = [
      { chave: 'system_mode', valor: mode, tipo: 'texto', categoria: 'geral', descricao: 'staging or production' },
      { chave: 'block_qa_seed', valor: mode === 'production' ? 'true' : 'false', tipo: 'texto', categoria: 'geral' },
      { chave: 'block_debug', valor: mode === 'production' ? 'true' : 'false', tipo: 'texto', categoria: 'geral' }
    ];

    let configFailed = false;
    for (const config of configs) {
      try {
        const existing = await base44.entities.ConfiguracaoSistema.filter({ chave: config.chave }, undefined, 1);
        if (existing && existing.length > 0) {
          await base44.entities.ConfiguracaoSistema.update(existing[0].id, config);
        } else {
          await base44.entities.ConfiguracaoSistema.create(config);
        }
        persisted = 'ConfiguracaoSistema';
      } catch (e) {
        configFailed = true;
      }
    }

    // Fallback: salvar em HealthCheck se ConfiguracaoSistema falhou
    if (configFailed) {
      try {
        await base44.entities.HealthCheck.create({
          tipo: 'producao',
          status: 'ok',
          detalhes: {
            mode: mode,
            ativado_por: user.email,
            block_qa_seed: mode === 'production',
            block_debug: mode === 'production',
            qa_status: qaStatus
          },
          build_id: buildId
        });
        persisted = 'HealthCheck';
      } catch (e) {
        // Fallback também falhou, retornar erro
        return Response.json({
          ok: false,
          build_id: buildId,
          error: 'PERSISTENCE_FAILED'
        }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      mode: mode,
      persisted: persisted,
      qa_status: qaStatus,
      block_qa_seed: mode === 'production',
      block_debug: mode === 'production',
      duracao_ms: Date.now() - startTime
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});