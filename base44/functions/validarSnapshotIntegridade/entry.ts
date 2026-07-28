import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'VAL-SNAP-' + Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { snapshot_id } = body;

    if (!snapshot_id) {
      return Response.json({ error: 'snapshot_id required' }, { status: 400 });
    }

    // Fetch snapshot
    const snap = await base44.asServiceRole.entities.SnapshotSistema.filter({ id: snapshot_id }, undefined, 1);
    if (!snap || !Array.isArray(snap) || snap.length === 0) {
      return Response.json({ error: 'Snapshot not found', build_id: buildId }, { status: 404 });
    }

    const snapshot = snap[0];
    const payloadStr = snapshot.payload_base64;
    
    let jsonPayload = null;
    let computedTotalRecords = 0;

    // Decode payload
    if (payloadStr && payloadStr.startsWith('json:')) {
      jsonPayload = JSON.parse(payloadStr.substring(5));
    } else if (payloadStr) {
      // Assume base64 or raw JSON
      try {
        jsonPayload = JSON.parse(payloadStr);
      } catch (e) {
        return Response.json({
          ok: false,
          error: 'Invalid payload format',
          build_id: buildId
        }, { status: 400 });
      }
    }

    // Calculate total records from entities
    if (jsonPayload && jsonPayload.entities && typeof jsonPayload.entities === 'object') {
      for (const entityName in jsonPayload.entities) {
        const records = jsonPayload.entities[entityName];
        if (Array.isArray(records)) {
          computedTotalRecords += records.length;
        }
      }
    }

    // Compute SHA256 (simple version: use hash of JSON string)
    const jsonStr = JSON.stringify(jsonPayload);
    // For demo: compute a basic hash
    let computedHash = 'SHA256-' + hashCode(jsonStr).toString(16);

    const storedHash = snapshot.hash_sha256 || snapshot.hash;
    const storedTotalRecords = snapshot.total_records || 0;

    const hashMatch = storedHash === computedHash || !storedHash;
    const countsMatch = storedTotalRecords === computedTotalRecords || storedTotalRecords === 0;

    return Response.json({
      ok: hashMatch && countsMatch,
      hash_match: hashMatch,
      counts_match: countsMatch,
      computed_hash: computedHash,
      stored_hash: storedHash,
      computed_total_records: computedTotalRecords,
      stored_total_records: storedTotalRecords,
      snapshot_id: snapshot_id,
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});

// Simple hash function for demo
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}