import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `OUTBOX-ARCHIVE-${Date.now()}`;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const older_than_days = body.older_than_days || 14;
  const keep_last_n = body.keep_last_n || 500;

  try {
    const now = new Date();
    const windowMs = older_than_days * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - windowMs).toISOString();

    // Listar sent items não arquivados, anteriores ao cutoff
    const items = await base44.asServiceRole.entities.OpsOutbox.filter(
      {
        status: 'sent',
        archived: false
      },
      'sent_at_iso',
      1000
    );

    let archivedCount = 0;
    let keptCount = 0;

    if (items && Array.isArray(items)) {
      // Ordenar desc por sent_at e manter os últimos keep_last_n
      const sorted = [...items].sort((a, b) => {
        const da = new Date(a.sent_at_iso || a.created_at_iso || 0);
        const db = new Date(b.sent_at_iso || b.created_at_iso || 0);
        return db.getTime() - da.getTime();
      });

      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const sentDate = new Date(item.sent_at_iso || item.created_at_iso);

        // Arquivar se: passou do cutoff E não está dentro dos keep_last_n
        if (sentDate.toISOString() < cutoffDate && i >= keep_last_n) {
          await base44.asServiceRole.entities.OpsOutbox.update(item.id, {
            archived: true,
            archived_at: now.toISOString(),
            archived_by: user.email,
            build_id: buildId
          });
          archivedCount++;
        } else {
          keptCount++;
        }
      }
    }

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'ARCHIVE',
        modulo: 'ops',
        entidade: 'OpsOutbox',
        detalhes: `Arquivados: ${archivedCount}, Mantidos: ${keptCount}, Dias: ${older_than_days}, Últimos: ${keep_last_n}`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      archived_count: archivedCount,
      kept_count: keptCount,
      window_days: older_than_days
    });
  } catch (error) {
    console.error('Erro em arquivarOpsOutbox:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});