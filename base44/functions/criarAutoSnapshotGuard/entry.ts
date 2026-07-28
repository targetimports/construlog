import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'GUARD-' + Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { acao, escopo, reason, entity_hint } = body;

    // Check system config directly
    let canWrite = true;
    let blockReason = null;
    try {
      const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      const map = {};
      if (cfgs && Array.isArray(cfgs)) {
        cfgs.forEach(c => { map[c.chave] = c.valor; });
      }
      
      if (map['system_mode'] === 'safe') {
        canWrite = false;
        blockReason = 'SAFE_MODE';
      }
      
      if (map['circuit_breaker_enabled'] !== 'false') {
        // Check runtime health
        try {
          const errors = await base44.asServiceRole.entities.HealthCheck.filter(
            { tipo: 'runtime_error', severidade: 'critical' },
            '-created_date',
            10
          );
          if (errors && errors.length >= (parseInt(map['health_critical_errors']) || 8)) {
            canWrite = false;
            blockReason = 'CIRCUIT_BREAKER';
          }
        } catch (e) {
          // ignore health check
        }
      }
    } catch (e) {
      // Default: allow (staging mode)
    }

    // ALWAYS create RollbackJob (even if blocked)
    let rollbackJob = null;
    if (!canWrite) {
      rollbackJob = await base44.asServiceRole.entities.RollbackJob.create({
        status: 'falha',
        motivo: 'AUTO_SNAPSHOT_GUARD_BLOCKED',
        snapshot_id: null,
        escopo: escopo || 'LIGHT',
        acao: acao,
        initiated_by: user.email,
        initiated_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        dry_run: false,
        error: blockReason
      });

      return Response.json({
        ok: false,
        error: 'WRITE_BLOCKED',
        reason_detail: blockReason || 'Unknown',
        guard_id: null,
        snapshot_id: null,
        rollback_job_id: rollbackJob.id,
        build_id: buildId
      }, { status: 403 });
    }

    // Create snapshot
    const defaultEntities = [
      'ConfiguracaoSistema', 'HealthCheck', 'ContaFinanceira', 'SaldoEstoque',
      'MovimentacaoEstoque', 'OrdemCompra', 'RecebimentoMaterial', 'Aprovacao',
      'RequisicaoCompra', 'CategoriaFinanceira', 'CentroCusto', 'RateioAdministrativo',
      'MedicaoObra', 'MedicaoContrato', 'Contrato', 'ApontamentoHora'
    ];

    const snapshot = {
      nome: `SNAP-${Date.now()}`,
      escopo: escopo || 'LIGHT',
      created_by: user.email,
      created_at: new Date().toISOString(),
      meta: { counts: {} },
      entities: {}
    };

    let totalRecords = 0;
    for (const entityName of defaultEntities) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 500);
        const count = Array.isArray(records) ? records.length : 0;
        snapshot.meta.counts[entityName] = count;
        snapshot.entities[entityName] = records || [];
        totalRecords += count;
      } catch (e) {
        snapshot.meta.counts[entityName] = 0;
      }
    }

    const payloadJson = JSON.stringify(snapshot);
    const payloadBytes = new TextEncoder().encode(payloadJson).length;

    // Persist snapshot
    const snapRecord = await base44.asServiceRole.entities.SnapshotSistema.create({
      nome: snapshot.nome,
      escopo: escopo || 'LIGHT',
      status: 'criado',
      created_by: user.email,
      created_at: new Date().toISOString(),
      meta: snapshot.meta,
      payload_base64: 'json:' + payloadJson,
      hash: 'HASH-' + Date.now(),
      tamanho_bytes: payloadBytes
    });

    // Create success RollbackJob
    rollbackJob = await base44.asServiceRole.entities.RollbackJob.create({
      status: 'criado',
      motivo: 'AUTO_SNAPSHOT_GUARD',
      snapshot_id: snapRecord.id,
      escopo: escopo || 'LIGHT',
      acao: acao,
      initiated_by: user.email,
      initiated_at: new Date().toISOString(),
      dry_run: false
    });

    const guardId = 'GUARD-' + Date.now();

    return Response.json({
      ok: true,
      guard_id: guardId,
      snapshot_id: snapRecord.id,
      rollback_job_id: rollbackJob.id,
      acao: acao,
      escopo: escopo || 'LIGHT',
      reason: reason,
      snapshot_counts: snapshot.meta.counts,
      total_records: totalRecords,
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});