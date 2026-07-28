import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch system config
    const cfg = await base44.asServiceRole.entities.ConfiguracaoSistema.list();
    
    const parseValue = (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (!isNaN(val)) return parseInt(val);
      return val;
    };

    const guardrails = {
      system_mode: cfg.find(c => c.chave === 'system_mode')?.valor || 'safe',
      ops_allow_restore_prod: parseValue(cfg.find(c => c.chave === 'ops_allow_restore_prod')?.valor || 'false'),
      ops_restore_prod_requires_qa_pass: parseValue(cfg.find(c => c.chave === 'ops_restore_prod_requires_qa_pass')?.valor || 'true'),
      ops_restore_prod_requires_window: parseValue(cfg.find(c => c.chave === 'ops_restore_prod_requires_window')?.valor || 'true'),
      ops_restore_prod_confirm_code: cfg.find(c => c.chave === 'ops_restore_prod_confirm_code')?.valor || '',
      ops_qa_pass_max_age_minutes: parseInt(cfg.find(c => c.chave === 'ops_qa_pass_max_age_minutes')?.valor || '30'),
      ops_maintenance_tz: cfg.find(c => c.chave === 'ops_maintenance_tz')?.valor || 'America/Bahia',
      ops_maintenance_start_hhmm: cfg.find(c => c.chave === 'ops_maintenance_start_hhmm')?.valor || '22:00',
      ops_maintenance_end_hhmm: cfg.find(c => c.chave === 'ops_maintenance_end_hhmm')?.valor || '04:00',
      ops_maintenance_enabled: parseValue(cfg.find(c => c.chave === 'ops_maintenance_enabled')?.valor || 'true')
    };

    return Response.json({
      ok: true,
      build_id: 'GUARDRAILS-' + Date.now(),
      guardrails
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});