import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'OPS-STATUS-' + Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch configs directly instead of via invoke
    let config = { system_mode: 'staging', circuit_breaker_enabled: true };
    try {
      const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      if (cfgs && Array.isArray(cfgs)) {
        const map = {};
        cfgs.forEach(c => { map[c.chave] = c.valor; });
        config.system_mode = map['system_mode'] || 'staging';
        config.circuit_breaker_enabled = map['circuit_breaker_enabled'] !== 'false';
      }
    } catch (e) {
      // ignore
    }

    // Get health info directly
    let health = { qa_gate: 'not_run', runtime_health: 'unknown' };
    try {
      const checks = await base44.asServiceRole.entities.HealthCheck.filter({ tipo: 'qa_gate' }, '-created_date', 1);
      if (checks && checks.length > 0) {
        health.qa_gate = checks[0].detalhes?.qa_gate_status || 'unknown';
      }
    } catch (e) {
      // ignore
    }

    // Get snapshot metrics
    let lastSnapshot = null;
    let totalSnapshots = 0;
    let totalActiveSnapshots = 0;
    let totalArchivedSnapshots = 0;
    let approxTotalBytesActive = 0;

    try {
      const allSnaps = await base44.asServiceRole.entities.SnapshotSistema.filter({}, '-created_at', 1000);
      const snapArray = Array.isArray(allSnaps) ? allSnaps : [];
      
      totalSnapshots = snapArray.length;
      
      for (const snap of snapArray) {
        if (snap.archived) {
          totalArchivedSnapshots++;
        } else {
          totalActiveSnapshots++;
          approxTotalBytesActive += (snap.tamanho_bytes || 0);
        }
      }

      // Get last active snapshot
      const activeSnaps = snapArray.filter(s => !s.archived);
      if (activeSnaps.length > 0) {
        lastSnapshot = activeSnaps[0];
      }
    } catch (e) {
      // ignore
    }

    // Get last rollback job
    let lastRollback = null;
    try {
      const jobs = await base44.asServiceRole.entities.RollbackJob.filter({}, '-initiated_at', 1);
      lastRollback = Array.isArray(jobs) && jobs.length > 0 ? jobs[0] : null;
    } catch (e) {
      // ignore
    }

    return Response.json({
      ok: true,
      ops_status: {
        system_mode: config.system_mode || 'staging',
        circuit_breaker_enabled: config.circuit_breaker_enabled !== false,
        safe_mode: config.system_mode === 'safe',
        qa_gate_status: health.qa_gate || 'not_run',
        runtime_health: health.runtime_health || 'unknown',
        total_snapshots: totalSnapshots,
        total_active_snapshots: totalActiveSnapshots,
        total_archived_snapshots: totalArchivedSnapshots,
        approx_total_bytes_active: approxTotalBytesActive,
        last_snapshot: lastSnapshot ? {
          id: lastSnapshot.id,
          nome: lastSnapshot.nome,
          escopo: lastSnapshot.escopo,
          created_at: lastSnapshot.created_at,
          created_at_iso: lastSnapshot.created_at_iso,
          tamanho_bytes: lastSnapshot.tamanho_bytes,
          hash: lastSnapshot.hash_sha256 || lastSnapshot.hash,
          archived: lastSnapshot.archived,
          pinned: lastSnapshot.pinned
        } : null,
        last_rollback: lastRollback ? {
          id: lastRollback.id,
          status: lastRollback.status,
          acao: lastRollback.acao,
          initiated_at: lastRollback.initiated_at,
          pre_snapshot_id: lastRollback.pre_snapshot_id
        } : null
      },
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});