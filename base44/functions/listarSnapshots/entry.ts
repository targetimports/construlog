import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'PROMPT13-2026-02-14-B';

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body.status;
    const escopo = body.escopo;
    const limit = body.limit || 50;

    let query = {};
    if (status) query.status = status;
    if (escopo) query.escopo = escopo;

    const snapshots = await base44.entities.SnapshotSistema.list(undefined, limit);
    
    return Response.json({
      ok: true,
      build_id: buildId,
      snapshots: snapshots || [],
      total: snapshots ? snapshots.length : 0
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});