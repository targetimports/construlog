import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'PIN-SNAP-' + Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { snapshot_id, pinned = true } = body;

    if (!snapshot_id) {
      return Response.json({ error: 'snapshot_id required' }, { status: 400 });
    }

    // Update snapshot
    const updated = await base44.asServiceRole.entities.SnapshotSistema.update(snapshot_id, {
      pinned: pinned
    });

    return Response.json({
      ok: true,
      snapshot_id: snapshot_id,
      pinned: pinned,
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});