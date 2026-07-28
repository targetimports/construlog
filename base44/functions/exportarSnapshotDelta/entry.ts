import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const LIGHT_ENTITIES = [
  'ConfiguracaoSistema', 'HealthCheck', 'ContaFinanceira', 'SaldoEstoque',
  'MovimentacaoEstoque', 'OrdemCompra', 'RecebimentoMaterial', 'Aprovacao',
  'RequisicaoCompra', 'CategoriaFinanceira', 'CentroCusto', 'RateioAdministrativo',
  'MedicaoObra', 'MedicaoContrato', 'Contrato', 'ApontamentoHora'
];

async function sha256(data) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return 'SHA256-' + hashHex.substring(0, 8);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { base_snapshot_id, entities_allowlist, max_records_per_entity, delta_since_iso, reason } = await req.json();

    if (!base_snapshot_id) {
      return Response.json({ error: 'base_snapshot_id required', field: 'base_snapshot_id' }, { status: 400 });
    }

    // Fetch base snapshot
    const baseSnap = await base44.asServiceRole.entities.SnapshotSistema.list();
    const snap = baseSnap.find(s => s.id === base_snapshot_id);
    
    if (!snap) {
      return Response.json({ error: 'base_snapshot_id not found' }, { status: 404 });
    }

    const created_at_iso = snap.created_at_iso || snap.created_at || new Date().toISOString();
    const since_iso = delta_since_iso || created_at_iso;
    const entities = entities_allowlist || LIGHT_ENTITIES;
    const maxPerEntity = max_records_per_entity || 200;

    // Collect delta
    const deltaData = {};
    const deltaCounts = {};
    const sampleIds = {};

    for (const entityName of entities) {
      try {
        const allRecords = await base44.asServiceRole.entities[entityName].list();
        
        // Filter by updated_date >= since_iso
        const filtered = allRecords.filter(r => {
          const ts = r.updated_date || r.created_date;
          return ts && new Date(ts) >= new Date(since_iso);
        }).sort((a, b) => {
          const aTs = new Date(a.updated_date || a.created_date);
          const bTs = new Date(b.updated_date || b.created_date);
          return bTs - aTs; // desc
        }).slice(0, maxPerEntity);

        if (filtered.length > 0) {
          deltaData[entityName] = filtered;
          deltaCounts[entityName] = filtered.length;
          sampleIds[entityName] = filtered.slice(0, 5).map(r => r.id);
        }
      } catch (e) {
        // Entity may not exist, skip
      }
    }

    // Serialize and hash
    const jsonStr = JSON.stringify(deltaData);
    const hashSha256 = await sha256(jsonStr);
    const base64Payload = btoa(unescape(encodeURIComponent(jsonStr)));
    const tamanhoBytes = new TextEncoder().encode(jsonStr).length;

    const totalRecords = Object.values(deltaCounts).reduce((sum, n) => sum + n, 0);
    const entitiesCount = Object.keys(deltaCounts).length;

    // Create SnapshotSistema
    const deltaSnap = await base44.asServiceRole.entities.SnapshotSistema.create({
      nome: `SNAP-DELTA-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      escopo: 'DELTA',
      created_by: user.email,
      created_at_iso: new Date().toISOString(),
      hash_sha256: hashSha256,
      tamanho_bytes: tamanhoBytes,
      total_records: totalRecords,
      entities_count: entitiesCount,
      payload_base64: base64Payload,
      base_snapshot_id,
      delta_since_iso: since_iso,
      delta_entities: Object.keys(deltaCounts),
      delta_counts: deltaCounts,
      restore_strategy: 'UPSERT_ONLY',
      sample_ids: sampleIds,
      reason: reason || 'MANUAL_DELTA',
      archived: false,
      pinned: false
    });

    return Response.json({
      ok: true,
      build_id: 'DELTA-SNAP-' + Date.now(),
      snapshot_id: deltaSnap.id,
      scope: 'DELTA',
      base_snapshot_id,
      delta_since_iso: since_iso,
      total_records: totalRecords,
      entities_count: entitiesCount,
      hash_sha256: hashSha256,
      tamanho_bytes: tamanhoBytes,
      delta_counts: deltaCounts
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});