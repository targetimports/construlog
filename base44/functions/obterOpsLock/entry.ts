import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'GET-LOCK-HARDENED-1771102501';

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const tipo = body.tipo;

    if (!tipo || !['RESTORE', 'ROLLBACK'].includes(tipo)) {
      return Response.json(
        { ok: false, error: 'Missing or invalid tipo', build_id: buildId },
        { status: 400 }
      );
    }

    const now = new Date();

    // Buscar locks ativos deste tipo, mais recentes primeiro
    const locks = await base44.asServiceRole.entities.OpsLock.filter(
      { tipo, status: 'ativo' },
      '-created_date',
      20
    );

    if (!locks || !Array.isArray(locks) || locks.length === 0) {
      return Response.json({
        ok: true,
        build_id: buildId,
        exists: false
      });
    }

    // Encontrar o lock ativo válido mais recente
    for (const lock of locks) {
      if (!lock.expires_at_iso) {
        continue;
      }

      const expiresAt = new Date(lock.expires_at_iso);
      if (isNaN(expiresAt.getTime())) {
        continue;
      }

      if (expiresAt >= now) {
        // Lock ativo e válido
        return Response.json({
          ok: true,
          build_id: buildId,
          exists: true,
          lock_id: lock.id,
          expires_at_iso: lock.expires_at_iso,
          started_by_email: lock.started_by_email,
          related: lock.related
        });
      } else {
        // Lock expirado - marcar como liberado
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

    // Nenhum lock ativo encontrado
    return Response.json({
      ok: true,
      build_id: buildId,
      exists: false
    });
  } catch (error) {
    console.error('Erro em obterOpsLock:', error.message);
    return Response.json(
      { ok: false, error: error.message, build_id: buildId },
      { status: 500 }
    );
  }
});