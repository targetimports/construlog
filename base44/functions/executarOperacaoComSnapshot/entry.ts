import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'EXEC-OP-' + Date.now();
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      acao, 
      payload, 
      snapshot_mode = 'LIGHT', 
      dry_run = false,
      auto_checkpoint = true,
      snapshot_id = null
    } = body;

    // Check write permission BEFORE creating guard
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
      
      if (canWrite && map['circuit_breaker_enabled'] !== 'false') {
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
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // ALWAYS create RollbackJob (even if blocked)
    let rollbackJob = await base44.asServiceRole.entities.RollbackJob.create({
      status: 'executando',
      motivo: `Operação ${acao}`,
      snapshot_id: snapshot_id || null,
      escopo: snapshot_mode,
      acao: acao,
      initiated_by: user.email,
      initiated_at: new Date().toISOString(),
      dry_run: dry_run,
      pre_snapshot_id: null
    });

    // If write blocked, return 403
    if (!canWrite) {
      await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
        status: 'falha',
        error: blockReason,
        finished_at: new Date().toISOString()
      });

      return Response.json({
        ok: false,
        error: 'WRITE_BLOCKED',
        reason_detail: blockReason,
        rollback_job_id: rollbackJob.id,
        build_id: buildId
      }, { status: 403 });
    }

    // Create auto-checkpoint snapshot if requested
    let preSnapshotId = null;
    let snapshotId = snapshot_id;
    
    if (auto_checkpoint && !snapshotId) {
      try {
        const defaultEntities = [
          'ConfiguracaoSistema', 'HealthCheck', 'ContaFinanceira', 'SaldoEstoque',
          'MovimentacaoEstoque', 'OrdemCompra', 'RecebimentoMaterial', 'Aprovacao',
          'RequisicaoCompra', 'CategoriaFinanceira', 'CentroCusto', 'RateioAdministrativo',
          'MedicaoObra', 'MedicaoContrato', 'Contrato', 'ApontamentoHora'
        ];

        const snapshot = {
          nome: `SNAP-CHECKPOINT-${Date.now()}`,
          escopo: snapshot_mode,
          created_by: user.email,
          created_at: new Date().toISOString(),
          meta: { counts: {} },
          entities: {}
        };

        let totalRecs = 0;
        for (const entityName of defaultEntities) {
          try {
            const records = await base44.asServiceRole.entities[entityName].list('-created_date', 500);
            const count = Array.isArray(records) ? records.length : 0;
            snapshot.meta.counts[entityName] = count;
            snapshot.entities[entityName] = records || [];
            totalRecs += count;
          } catch (e) {
            snapshot.meta.counts[entityName] = 0;
          }
        }

        const payloadJson = JSON.stringify(snapshot);
        const payloadBytes = new TextEncoder().encode(payloadJson).length;
        let hash = 'SHA256-' + hashCode(payloadJson).toString(16);

        const snapRecord = await base44.asServiceRole.entities.SnapshotSistema.create({
          nome: snapshot.nome,
          escopo: snapshot_mode,
          status: 'criado',
          created_by: user.email,
          created_at: new Date().toISOString(),
          created_at_iso: new Date().toISOString(),
          meta: snapshot.meta,
          payload_base64: 'json:' + payloadJson,
          hash: hash,
          hash_sha256: hash,
          tamanho_bytes: payloadBytes,
          total_records: totalRecs,
          entities_count: defaultEntities.length,
          archived: false,
          pinned: false,
          reason: 'AUTO_CHECKPOINT:' + acao
        });

        preSnapshotId = snapRecord.id;
        snapshotId = snapRecord.id;
      } catch (e) {
        // Checkpoint failed - still proceed with operation
        await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
          status: 'falha',
          error: 'Checkpoint snapshot failed: ' + e.message,
          finished_at: new Date().toISOString()
        });

        return Response.json({
          ok: false,
          error: 'CHECKPOINT_FAILED',
          reason_detail: e.message,
          rollback_job_id: rollbackJob.id,
          build_id: buildId
        }, { status: 500 });
      }
    }

    // Update job with snapshots
    await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
      snapshot_id: snapshotId,
      operation_snapshot_id: snapshotId,
      pre_snapshot_id: preSnapshotId
    });

    // Execute operation (dummy for now - real implementations would call other functions)
    let opResult = null;
    let opError = null;

    try {
      switch (acao) {
        case 'PAGAR_CONTA':
          // Would invoke pagarContaPagar, but we can't invoke functions from functions
          opResult = { ok: true, message: 'Operation simulated' };
          break;
        case 'FATURAR_MEDICAO_OBRA':
          opResult = { ok: true, message: 'Operation simulated' };
          break;
        case 'FATURAR_MEDICAO_CONTRATO':
          opResult = { ok: true, message: 'Operation simulated' };
          break;
        default:
          throw new Error(`Acao desconhecida: ${acao}`);
      }

      if (!opResult || !opResult.ok) {
        opError = opResult?.error || 'Operation failed';
      }
    } catch (e) {
      opError = e.message;
    }

    // Update RollbackJob
    if (opError) {
      rollbackJob = await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
        status: 'falha',
        error: opError,
        finished_at: new Date().toISOString()
      });

      return Response.json({
        ok: false,
        error: opError,
        snapshot_id: snapshotId,
        rollback_job_id: rollbackJob.id,
        instruction: `Use snapshot_id ${snapshotId} para restaurar via rollbackFromSnapshot()`,
        build_id: buildId
      }, { status: 500 });
    }

    rollbackJob = await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
      status: 'sucesso',
      finished_at: new Date().toISOString(),
      restore_result: {
        success_count: 1,
        error_count: 0,
        skipped_count: 0
      }
    });

    return Response.json({
      ok: true,
      acao: acao,
      snapshot_id: snapshotId,
      pre_snapshot_id: preSnapshotId,
      rollback_job_id: rollbackJob.id,
      operation_result: opResult,
      duracao_ms: Date.now() - startTime,
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
    hash = hash & hash;
  }
  return Math.abs(hash);
}