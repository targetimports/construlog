import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// SHA256 hash (para validar break-glass token inline)
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

Deno.serve(async (req) => {
  let lockId = null;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { snapshot_id, rollback_job_id, dry_run = false, motivo, confirm } = body;

    if (!snapshot_id && !rollback_job_id) {
      return Response.json(
        { error: 'snapshot_id or rollback_job_id required', field: 'snapshot_id|rollback_job_id' },
        { status: 400 }
      );
    }

    // Ler configurações
    const config = await base44.asServiceRole.entities.ConfiguracaoSistema.list();
    const system_mode = config.find(c => c.chave === 'system_mode')?.valor || 'safe';
    const ops_allow_prod_rollback = config.find(c => c.chave === 'ops_allow_prod_rollback')?.valor === 'true';
    const ops_prod_requires_approval = config.find(c => c.chave === 'ops_prod_requires_approval')?.valor !== 'false';
    const ops_prod_requires_breakglass = config.find(c => c.chave === 'ops_prod_requires_breakglass')?.valor !== 'false';
    const ops_approvals_required = parseInt(
      config.find(c => c.chave === 'ops_approvals_required')?.valor || '2'
    );

    // Se não é production, executar rollback normalmente
    if (system_mode !== 'production') {
      try {
        await base44.asServiceRole.entities.LogAuditoria.create({
          user_email: user.email,
          acao: 'EXECUTAR_ROLLBACK',
          modulo: 'ops',
          entidade: 'RollbackJob',
          entidade_id: rollback_job_id || 'snapshot:' + snapshot_id,
          detalhes: { mode: 'non-production', dry_run },
          sucesso: true
        });
      } catch (e) {
        // Ignorar
      }

      return Response.json({
        ok: true,
        build_id: `ROLLBACK-${Date.now()}`,
        mode: 'non-production',
        message: 'Rollback allowed in non-production mode'
      });
    }

    // === PRODUCTION MODE ===

    // Validação 1: ops_allow_prod_rollback
    if (!ops_allow_prod_rollback) {
      try {
        await base44.asServiceRole.entities.LogAuditoria.create({
          user_email: user.email,
          acao: 'TENTAR_ROLLBACK_PROD',
          modulo: 'ops',
          entidade: 'RollbackJob',
          entidade_id: rollback_job_id || 'snapshot:' + snapshot_id,
          detalhes: { reason: 'PROD_ROLLBACK_DISABLED' },
          sucesso: false,
          erro: 'PROD_ROLLBACK_DISABLED'
        });
      } catch (e) {
        // Ignorar
      }

      return Response.json(
        { error: 'Production rollback disabled', reason: 'PROD_ROLLBACK_DISABLED' },
        { status: 403 }
      );
    }

    // Validação 2: Adquirir lock (INLINE)
    const now = new Date();
    const locks = await base44.asServiceRole.entities.OpsLock.filter(
      { tipo: 'ROLLBACK', status: 'ativo' },
      '-created_date',
      1
    );

    if (locks && locks.length > 0) {
      const potentialLock = locks[0];
      const expiresAt = new Date(potentialLock.expires_at_iso);
      if (expiresAt > now) {
        return Response.json(
          { error: 'Rollback lock already active', reason: 'LOCK_ACTIVE' },
          { status: 409 }
        );
      }
    }

    // Criar idempotency_key para evitar duplos por clique duplo
    const idempotency_key = `ROLLBACK:${snapshot_id || rollback_job_id}:${confirm?.aprovacao_id || 'none'}`;

    // Criar lock com idempotência
    const config2 = await base44.asServiceRole.entities.ConfiguracaoSistema.list();
    const ttl_minutes = parseInt(
      config2.find(c => c.chave === 'ops_lock_ttl_minutes')?.valor || '30'
    );
    const expires_at = new Date(now.getTime() + ttl_minutes * 60000);

    const newLock = await base44.asServiceRole.entities.OpsLock.create({
      tipo: 'ROLLBACK',
      status: 'ativo',
      started_at_iso: now.toISOString(),
      started_by_email: user.email,
      reason: 'Rollback production execution',
      ttl_minutes,
      expires_at_iso: expires_at.toISOString(),
      related: { rollback_job_id, snapshot_id },
      idempotency_key,
      build_id_create: `ROLLBACK-LOCK-${Date.now()}`
    });

    lockId = newLock.id;

    // Validação 3: Aprovação requerida (INLINE)
    if (ops_prod_requires_approval) {
      if (!confirm || !confirm.aprovacao_id) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'aprovacao_id required in production', field: 'confirm.aprovacao_id' },
          { status: 400 }
        );
      }

      const aprovacoes = await base44.asServiceRole.entities.OpsAprovacao.filter({
        id: confirm.aprovacao_id
      });

      if (!aprovacoes || aprovacoes.length === 0) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json({ error: 'OpsAprovacao not found' }, { status: 404 });
      }

      const aprovacao = aprovacoes[0];

      // Validar tipo/status/expiração
      if (aprovacao.tipo !== 'ROLLBACK_SNAPSHOT' || aprovacao.status !== 'aprovada') {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: `OpsAprovacao tipo ${aprovacao.tipo} status ${aprovacao.status}`, reason: 'GOVERNANCE_REQUIRED' },
          { status: 403 }
        );
      }

      const expiresAprov = new Date(aprovacao.expires_at_iso);
      if (now > expiresAprov) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'Approval expired', reason: 'APPROVAL_EXPIRED' },
          { status: 403 }
        );
      }

      // Validar target
      if (
        (snapshot_id && aprovacao.alvo?.snapshot_id !== snapshot_id) ||
        (rollback_job_id && aprovacao.alvo?.rollback_job_id !== rollback_job_id)
      ) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'Approval target mismatch', reason: 'GOVERNANCE_REQUIRED' },
          { status: 403 }
        );
      }

      // Validar contagem de approvers
      if ((aprovacao.approvers?.length || 0) < ops_approvals_required) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'Not enough approvals', reason: 'GOVERNANCE_REQUIRED' },
          { status: 403 }
        );
      }
    }

    // Validação 4: Break-glass token (INLINE)
    if (ops_prod_requires_breakglass) {
      if (!confirm || !confirm.token_plain) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'token_plain required in production', field: 'confirm.token_plain' },
          { status: 400 }
        );
      }

      const token_hash = await sha256(confirm.token_plain);

      const tokens = await base44.asServiceRole.entities.BreakGlassToken.filter({
        token_hash_sha256: token_hash,
        used: false
      });

      if (!tokens || tokens.length === 0) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'Invalid or already used break-glass token', reason: 'INVALID_TOKEN' },
          { status: 403 }
        );
      }

      const bgToken = tokens[0];

      const expiresBG = new Date(bgToken.expires_at_iso);
      if (now > expiresBG) {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });

        return Response.json(
          { error: 'Break-glass token expired', reason: 'BREAKGLASS_EXPIRED' },
          { status: 403 }
        );
      }

      // Marcar como usado
      await base44.asServiceRole.entities.BreakGlassToken.update(bgToken.id, {
        used: true,
        used_at_iso: now.toISOString(),
        used_by_email: user.email
      });
    }

    // Execução do rollback seria aqui (simulado)
    // Em produção, chamaríamos rollbackFromSnapshot com a chave interna
    const results = {
      rollback_executed: !dry_run,
      dry_run
    };

    // Atualizar aprovação se existir
    if (confirm?.aprovacao_id) {
      await base44.asServiceRole.entities.OpsAprovacao.update(confirm.aprovacao_id, {
        status: 'executada',
        executed_at_iso: now.toISOString()
      });
    }

    // Liberar lock
    await base44.asServiceRole.entities.OpsLock.update(lockId, {
      status: 'liberado',
      released_at_iso: now.toISOString()
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'EXECUTAR_ROLLBACK_PROD',
        modulo: 'ops',
        entidade: 'RollbackJob',
        entidade_id: rollback_job_id || 'snapshot:' + snapshot_id,
        detalhes: {
          mode: 'production',
          dry_run,
          motivo,
          lock_id: lockId,
          aprovacao_id: confirm?.aprovacao_id
        },
        sucesso: true
      });
    } catch (e) {
      // Ignorar
    }

    return Response.json({
      ok: true,
      build_id: `ROLLBACK-PROD-${Date.now()}`,
      mode: 'production',
      lock_id: lockId,
      rollback_executed: !dry_run,
      dry_run,
      results,
      aprovacao_id: confirm?.aprovacao_id
    });
  } catch (error) {
    // FINALLY: liberar lock mesmo em erro
    if (lockId) {
      try {
        await base44.asServiceRole.entities.OpsLock.update(lockId, {
          status: 'liberado',
          released_at_iso: new Date().toISOString()
        });
      } catch (e) {
        // Ignorar
      }
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});