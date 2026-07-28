import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'RELEASE-LOCK-HARDENED-1771102502';

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const lock_id = body.lock_id;
    const motivo = body.motivo || 'manual';

    if (!lock_id) {
      return Response.json(
        { error: 'Missing lock_id', build_id: buildId },
        { status: 400 }
      );
    }

    // Buscar o lock
    let lock = null;
    try {
      const locks = await base44.asServiceRole.entities.OpsLock.filter(
        { id: lock_id },
        undefined,
        1
      );
      if (locks && Array.isArray(locks) && locks.length > 0) {
        lock = locks[0];
      }
    } catch (e) {
      console.error('Erro ao buscar lock:', e.message);
    }

    if (!lock) {
      return Response.json(
        { error: 'LOCK_NOT_FOUND', build_id: buildId },
        { status: 404 }
      );
    }

    // Se já liberado, retornar idempotente
    if (lock.status === 'liberado') {
      return Response.json({
        ok: true,
        build_id: buildId,
        released: true,
        released_at_iso: lock.released_at_iso || new Date().toISOString(),
        message: 'Lock já estava liberado'
      });
    }

    const now = new Date();

    // Atualizar lock para liberado
    await base44.asServiceRole.entities.OpsLock.update(lock_id, {
      status: 'liberado',
      released_at_iso: now.toISOString(),
      reason: motivo
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'UPDATE',
        modulo: 'ops',
        entidade: 'OpsLock',
        entidade_id: lock_id,
        dados_anteriores: {
          status: lock.status
        },
        dados_novos: {
          status: 'liberado',
          released_at_iso: now.toISOString()
        },
        detalhes: `Lock liberado (motivo: ${motivo})`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro ao auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      released: true,
      released_at_iso: now.toISOString()
    });
  } catch (error) {
    console.error('Erro em liberarOpsLock:', error.message);
    return Response.json(
      { error: error.message, build_id: buildId },
      { status: 500 }
    );
  }
});