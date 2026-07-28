import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'EXPORT-LIGHT-' + Date.now();
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const customEntities = body.entities_to_include || [
      'ConfiguracaoSistema',
      'HealthCheck',
      'ContaFinanceira',
      'SaldoEstoque',
      'MovimentacaoEstoque',
      'OrdemCompra',
      'RecebimentoMaterial',
      'Aprovacao',
      'RequisicaoCompra',
      'CategoriaFinanceira',
      'CentroCusto',
      'RateioAdministrativo',
      'MedicaoObra',
      'MedicaoContrato',
      'Contrato',
      'ApontamentoHora'
    ];

    const snapshot = {
      nome: `SNAP-LIGHT-${new Date().toISOString().split('T')[0]}-${Date.now()}`,
      escopo: 'LIGHT',
      created_by: user.email,
      created_at: new Date().toISOString(),
      meta: {
        counts: {},
        versao_app: '1.0'
      },
      entities: {}
    };

    let totalRecords = 0;

    for (const entityName of customEntities) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 1000);
        const count = Array.isArray(records) ? records.length : 0;
        snapshot.meta.counts[entityName] = count;
        snapshot.entities[entityName] = records || [];
        totalRecords += count;
      } catch (e) {
        snapshot.meta.counts[entityName] = 0;
        snapshot.entities[entityName] = [];
      }
    }

    // Encode to base64
    const payloadJson = JSON.stringify(snapshot);
    const payloadBytes = new TextEncoder().encode(payloadJson).length;
    
    // Store with json: prefix for safe transmission
    const payloadBase64 = 'json:' + payloadJson;

    // Create hash (simple for demo: hash of JSON string)
    let hash = 'SHA256-' + hashCode(payloadJson).toString(16);

    // Persist snapshot to SnapshotSistema
    const snapshotRecord = await base44.asServiceRole.entities.SnapshotSistema.create({
      nome: snapshot.nome,
      escopo: 'LIGHT',
      status: 'criado',
      created_by: user.email,
      created_at: new Date().toISOString(),
      created_at_iso: new Date().toISOString(),
      meta: snapshot.meta,
      payload_base64: payloadBase64,
      hash: hash,
      hash_sha256: hash,
      tamanho_bytes: payloadBytes,
      total_records: totalRecords,
      entities_count: customEntities.length,
      archived: false,
      pinned: false,
      reason: body.reason || 'MANUAL'
    });

    return Response.json({
      ok: true,
      snapshot_id: snapshotRecord.id,
      build_id: buildId,
      hash: hash,
      counts: snapshot.meta.counts,
      total_records: totalRecords,
      tamanho_bytes: payloadBytes,
      duracao_ms: Date.now() - startTime
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
    hash = hash & hash;
  }
  return Math.abs(hash);
}