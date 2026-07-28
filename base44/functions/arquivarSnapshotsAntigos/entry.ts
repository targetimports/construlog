import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'ARCH-SNAPS-' + Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load configuration
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => { configMap[c.chave] = c.valor; });
    }

    const keepLastN = parseInt(configMap['ops_snap_keep_last_n'] || '20');
    const keepDays = parseInt(configMap['ops_snap_keep_days'] || '14');
    const maxTotalBytes = parseInt(configMap['ops_snap_max_total_bytes'] || '50000000');

    // Get all active snapshots
    const allSnapshots = await base44.asServiceRole.entities.SnapshotSistema.filter(
      { archived: false },
      '-created_at',
      1000
    );
    
    const activeSnaps = Array.isArray(allSnapshots) ? allSnapshots : [];

    // Filter out pinned snapshots
    const archivableSnaps = activeSnaps.filter(s => !s.pinned);
    
    // Keep the most recent keepLastN
    const snapsToKeep = archivableSnaps.slice(0, keepLastN);
    const snapsToCheck = archivableSnaps.slice(keepLastN);

    let totalBytesBefore = activeSnaps.reduce((sum, s) => sum + (s.tamanho_bytes || 0), 0);
    let archivedCount = 0;
    let keptCount = snapsToKeep.length;
    const now = new Date();
    const keepUntil = new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000);

    // Archive old snapshots
    for (const snap of snapsToCheck) {
      const createdDate = new Date(snap.created_at);
      if (createdDate < keepUntil) {
        await base44.asServiceRole.entities.SnapshotSistema.update(snap.id, {
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.email
        });
        archivedCount++;
      }
    }

    // Re-fetch active snapshots to check total bytes
    const updatedActive = await base44.asServiceRole.entities.SnapshotSistema.filter(
      { archived: false },
      '-created_at',
      1000
    );
    const updatedActiveSnaps = Array.isArray(updatedActive) ? updatedActive : [];
    
    let totalBytesAfter = updatedActiveSnaps.reduce((sum, s) => sum + (s.tamanho_bytes || 0), 0);

    // If still over limit, archive more
    if (totalBytesAfter > maxTotalBytes) {
      const archivable = updatedActiveSnaps
        .filter(s => !s.pinned)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      for (const snap of archivable) {
        if (totalBytesAfter <= maxTotalBytes) break;
        
        await base44.asServiceRole.entities.SnapshotSistema.update(snap.id, {
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.email
        });
        totalBytesAfter -= (snap.tamanho_bytes || 0);
        archivedCount++;
      }
    }

    return Response.json({
      ok: true,
      archived_count: archivedCount,
      bytes_before: totalBytesBefore,
      bytes_after: totalBytesAfter,
      kept_count: keptCount,
      policy: {
        keep_last_n: keepLastN,
        keep_days: keepDays,
        max_total_bytes: maxTotalBytes
      },
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});