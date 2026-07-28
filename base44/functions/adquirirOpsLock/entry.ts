import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'ACQUIRE-LOCK-HARDENED-1771102500';
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const tipo = body.tipo;
    const reason = body.reason || 'Unknown reason';
    const idempotency_key = body.idempotency_key;
    const related = body.related || {};

    if (!tipo || !['RESTORE', 'ROLLBACK'].includes(tipo)) {
      return Response.json(
        { error: 'Missing or invalid tipo', build_id: buildId },
        { status: 400 }
      );
    }

    const now = new Date();

    // Buscar configuração de TTL
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => { configMap[c.chave] = c.valor; });
    }
    const ttlMinutesStr = configMap['ops_lock_ttl_minutes'] || '30';
    const ttlMinutes = Math.max(5, Math.min(1440, parseInt(ttlMinutesStr, 10) || 30));

    // Buscar locks existentes deste tipo (ordenado por criação recente)
    const locks = await base44.asServiceRole.entities.OpsLock.filter(
      { tipo, status: 'ativo' },
      '-created_date',
      20
    );

    // Validar locks e encontrar um ativo real
    let activeLock = null;
    if (locks && Array.isArray(locks) && locks.length > 0) {
      for (const lock of locks) {
        if (!lock.expires_at_iso) {
          continue;
        }

        const expiresAt = new Date(lock.expires_at_iso);
        if (isNaN(expiresAt.getTime())) {
          continue;
        }

        if (expiresAt >= now) {
          // Lock ainda ativo
          activeLock = lock;
          break;
        } else {
          // Lock expirado - atualizar
          try {
            await base44.asServiceRole.entities.OpsLock.update(lock.id, {
              status: 'liberado',
              released_at_iso: now.toISOString(),
              reason: 'AUTO_EXPIRED'
            });
          } catch (e) {
            console.error('Erro ao atualizar lock expirado:', e.message);
          }
        }
      }
    }

    // Se há lock ativo
    if (activeLock) {
      // Idempotência: se chave bate, reutilizar
      if (idempotency_key && activeLock.idempotency_key === idempotency_key) {
        return Response.json({
          ok: true,
          build_id: buildId,
          reused: true,
          lock_id: activeLock.id,
          expires_at_iso: activeLock.expires_at_iso,
          ttl_minutes: ttlMinutes
        });
      }

      // Lock ativo, sem idempotência = conflito
      return Response.json(
        {
          ok: false,
          error: 'LOCK_ACTIVE',
          lock: {
            id: activeLock.id,
            expires_at_iso: activeLock.expires_at_iso,
            started_by_email: activeLock.started_by_email,
            related: activeLock.related
          },
          build_id: buildId
        },
        { status: 409 }
      );
    }

    // Criar novo lock
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const newLock = await base44.asServiceRole.entities.OpsLock.create({
      tipo,
      status: 'ativo',
      started_at_iso: now.toISOString(),
      expires_at_iso: expiresAt.toISOString(),
      started_by_email: user.email,
      reason,
      ttl_minutes: ttlMinutes,
      idempotency_key: idempotency_key || undefined,
      related: Object.keys(related).length > 0 ? related : undefined,
      build_id_create: buildId
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'CREATE',
        modulo: 'ops',
        entidade: 'OpsLock',
        entidade_id: newLock.id,
        dados_novos: {
          tipo,
          started_at_iso: now.toISOString(),
          expires_at_iso: expiresAt.toISOString()
        },
        detalhes: `Lock criado para ${tipo} com TTL ${ttlMinutes} min`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro ao auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      reused: false,
      lock_id: newLock.id,
      expires_at_iso: expiresAt.toISOString(),
      ttl_minutes: ttlMinutes
    });
  } catch (error) {
    console.error('Erro em adquirirOpsLock:', error.message);
    return Response.json(
      { error: error.message, build_id: buildId },
      { status: 500 }
    );
  }
});