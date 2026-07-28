import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const buildId = `CR-EXEC-${Date.now()}`;
  let crId = null;
  let lockId = null;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { change_id, dry_run = true, breakglass_token_plain } = body;

    if (!change_id) {
      return Response.json({ error: 'Missing change_id', field: 'change_id' }, { status: 400 });
    }

    // Carregar CR
    const crs = await base44.asServiceRole.entities.OpsChangeRequest.filter({ id: change_id }, undefined, 1);
    if (!crs || crs.length === 0) {
      return Response.json({ error: 'CR not found' }, { status: 404 });
    }

    const cr = crs[0];
    crId = cr.id;
    const now = new Date();

    // Exigir status approved
    if (cr.status !== 'approved') {
      return Response.json(
        { error: `CR status is ${cr.status}, must be approved`, reason: 'NOT_APPROVED' },
        { status: 403 }
      );
    }

    // Ler configurações
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => { configMap[c.chave] = c.valor; });
    }

    const system_mode = configMap['system_mode'] || 'staging';
    const ops_lock_ttl_minutes = parseInt(configMap['ops_lock_ttl_minutes'] || '30');

    // Adquirir lock
    const idempotency_key = `CR:${change_id}`;
    const expires_at = new Date(now.getTime() + ops_lock_ttl_minutes * 60 * 1000);

    let newLock = null;
    try {
      // Tentar reusar lock existente com idempotência
      const existingLocks = await base44.asServiceRole.entities.OpsLock.filter(
        { tipo: cr.tipo.includes('RESTORE') ? 'RESTORE' : 'ROLLBACK', status: 'ativo' },
        '-created_date',
        5
      );

      let foundActive = false;
      if (existingLocks && Array.isArray(existingLocks)) {
        for (const lock of existingLocks) {
          const expiresAt = new Date(lock.expires_at_iso);
          if (expiresAt >= now && lock.idempotency_key === idempotency_key) {
            lockId = lock.id;
            foundActive = true;
            break;
          }
        }
      }

      if (!foundActive) {
        newLock = await base44.asServiceRole.entities.OpsLock.create({
          tipo: cr.tipo.includes('RESTORE') ? 'RESTORE' : 'ROLLBACK',
          status: 'ativo',
          started_at_iso: now.toISOString(),
          started_by_email: user.email,
          reason: `Executing CR ${change_id}`,
          ttl_minutes: ops_lock_ttl_minutes,
          expires_at_iso: expires_at.toISOString(),
          idempotency_key,
          related: { change_request_id: change_id },
          build_id_create: buildId
        });
        lockId = newLock.id;
      }
    } catch (e) {
      console.error('Erro ao adquirir lock:', e.message);
      return Response.json({ error: 'Failed to acquire lock', build_id: buildId }, { status: 500 });
    }

    // Validações de production
    if (system_mode === 'production' && !dry_run) {
      if (cr.tipo.includes('RESTORE') && configMap['ops_allow_restore_prod'] !== 'true') {
        throw new Error('Production restore not allowed');
      }
      if (cr.tipo.includes('ROLLBACK') && configMap['ops_allow_prod_rollback'] !== 'true') {
        throw new Error('Production rollback not allowed');
      }

      if (configMap['ops_prod_requires_breakglass'] === 'true' && breakglass_token_plain) {
        const token_hash = await sha256(breakglass_token_plain);
        const tokens = await base44.asServiceRole.entities.BreakGlassToken.filter(
          { token_hash_sha256: token_hash, used: false },
          undefined,
          1
        );
        if (!tokens || tokens.length === 0) {
          throw new Error('Invalid or used break-glass token');
        }
        const bgToken = tokens[0];
        const expiresBG = new Date(bgToken.expires_at_iso);
        if (now > expiresBG) {
          throw new Error('Break-glass token expired');
        }
        await base44.asServiceRole.entities.BreakGlassToken.update(bgToken.id, {
          used: true,
          used_at_iso: now.toISOString(),
          used_by_email: user.email
        });
      }
    }

    // Capturar guardrails
    const guardrails_snapshot = {
      system_mode,
      ops_allow_restore_prod: configMap['ops_allow_restore_prod'] === 'true',
      ops_allow_prod_rollback: configMap['ops_allow_prod_rollback'] === 'true',
      ops_prod_requires_breakglass: configMap['ops_prod_requires_breakglass'] === 'true'
    };

    // Executar ação (simulado)
    const evidence = {
      preflight: {
        lock_acquired: true,
        guardrails_checked: true
      },
      duration_ms: 0,
      restored_entities: [],
      counts: {}
    };

    // Atualizar CR
    const newStatus = dry_run ? 'approved' : 'success';
    await base44.asServiceRole.entities.OpsChangeRequest.update(change_id, {
      status: newStatus,
      lock_id: lockId,
      guardrails_snapshot,
      evidence,
      build_id_last: buildId
    });

    // Criar outbox
    try {
      await base44.asServiceRole.entities.OpsOutbox.create({
        tipo: 'CR_EXECUTED',
        status: 'queued',
        channel: 'ui',
        target: 'ui',
        payload: { change_id, dry_run, executed_by: user.email },
        related_change_id: change_id,
        created_at_iso: now.toISOString(),
        build_id: buildId
      });
    } catch (e) {
      console.error('Erro outbox:', e.message);
    }

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'UPDATE',
        modulo: 'ops',
        entidade: 'OpsChangeRequest',
        entidade_id: change_id,
        dados_anteriores: { status: cr.status },
        dados_novos: { status: newStatus },
        detalhes: `CR executado (${dry_run ? 'dry_run' : 'real'})`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      status: newStatus,
      lock_id: lockId,
      evidence
    });
  } catch (error) {
    // Liberar lock no finally
    if (lockId) {
      try {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });
      } catch (e) {
        console.error('Erro ao liberar lock:', e.message);
      }
    }

    // Criar outbox FAILED
    if (crId) {
      try {
        await base44.asServiceRole.entities.OpsOutbox.create({
          tipo: 'CR_FAILED',
          status: 'queued',
          channel: 'ui',
          target: 'ui',
          payload: { change_id: crId, error: error.message },
          related_change_id: crId,
          created_at_iso: new Date().toISOString(),
          build_id: buildId
        });
      } catch (e) {
        console.error('Erro outbox fail:', e.message);
      }
    }

    console.error('Erro em executarOpsChangeRequest:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});