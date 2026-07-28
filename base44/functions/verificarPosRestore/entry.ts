import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function sha256(data) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return 'SHA256-' + hashHex.substring(0, 8);
}

function base64Decode(str) {
  try {
    // Handle json: prefix (from exportarSnapshotLight)
    if (str.startsWith('json:')) {
      return str.substring(5);
    }
    
    // Otherwise decode from base64
    const binaryStr = atob(str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    // Try unescape/decodeURIComponent variant
    try {
      return decodeURIComponent(atob(str));
    } catch {
      throw e;
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rollback_job_id, snapshot_id, mode } = await req.json();
    const verificationMode = mode || 'quick';

    let snapId = snapshot_id;
    if (!snapId && rollback_job_id) {
      const job = await base44.asServiceRole.entities.RollbackJob.list();
      const rj = job.find(j => j.id === rollback_job_id);
      if (rj && rj.restored_snapshot_id) {
        snapId = rj.restored_snapshot_id;
      }
    }

    if (!snapId) {
      return Response.json({ error: 'snapshot_id or rollback_job_id with restored_snapshot_id required' }, { status: 400 });
    }

    // Fetch snapshot
    const snaps = await base44.asServiceRole.entities.SnapshotSistema.list();
    const snap = snaps.find(s => s.id === snapId);
    
    if (!snap) {
      return Response.json({ error: 'snapshot not found' }, { status: 404 });
    }

    const startTime = Date.now();

    // Decode payload
    let payload = {};
    try {
      const decoded = base64Decode(snap.payload_base64);
      payload = JSON.parse(decoded);
    } catch (e) {
      return Response.json({ error: 'Failed to decode snapshot payload', details: e.message }, { status: 500 });
    }

    // Validate hash
    const jsonStr = JSON.stringify(payload);
    const computedHash = await sha256(jsonStr);
    const hashMatch = computedHash === snap.hash_sha256;

    // Validate counts
    let computedCounts = {};
    for (const [ent, records] of Object.entries(payload)) {
      if (Array.isArray(records)) {
        computedCounts[ent] = records.length;
      }
    }
    const computedTotal = Object.values(computedCounts).reduce((sum, n) => sum + n, 0);
    const countsMatch = computedTotal === snap.total_records;

    // Quick verification: check sample IDs
    let samplePassRate = 1.0;
    if (snap.sample_ids && verificationMode === 'quick') {
      let totalSample = 0;
      let existingSample = 0;
      
      for (const [entityName, ids] of Object.entries(snap.sample_ids)) {
        if (!Array.isArray(ids) || ids.length === 0) continue;
        totalSample += ids.length;
        
        try {
          const existing = await base44.asServiceRole.entities[entityName].list();
          const found = ids.filter(id => existing.some(r => r.id === id));
          existingSample += found.length;
        } catch (e) {
          // Entity may not exist
        }
      }
      
      if (totalSample > 0) {
        samplePassRate = existingSample / totalSample;
      }
    }

    // Determine pass/fail
    const verificationPass = hashMatch && countsMatch && samplePassRate >= 0.9;
    const verificationStatus = verificationPass ? 'pass' : 'fail';
    const verificationMs = Date.now() - startTime;

    // Update RollbackJob if applicable
    if (rollback_job_id) {
      const job = await base44.asServiceRole.entities.RollbackJob.list();
      const rj = job.find(j => j.id === rollback_job_id);
      if (rj) {
        await base44.asServiceRole.entities.RollbackJob.update(rollback_job_id, {
          verification_status: verificationStatus,
          verification_ms: verificationMs,
          verification_details: {
            hash_match: hashMatch,
            counts_match: countsMatch,
            sample_pass_rate: samplePassRate,
            mode: verificationMode
          }
        });
      }
    }

    return Response.json({
      ok: true,
      build_id: 'VERIFY-POST-' + Date.now(),
      verification_status: verificationStatus,
      hash_match: hashMatch,
      counts_match: countsMatch,
      sample_pass_rate: samplePassRate,
      details: {
        mode: verificationMode,
        verification_ms: verificationMs,
        snapshot_scope: snap.escopo,
        snapshot_id: snapId
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});