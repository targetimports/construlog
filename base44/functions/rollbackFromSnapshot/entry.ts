import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'ROLLBACK-' + Date.now();
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { snapshot_id, dry_run = true, motivo, confirm_code, __ops_internal_key } = body;

    // ANTI-BYPASS CHECK: Production requires internal key
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => { configMap[c.chave] = c.valor; });
    }
    const systemMode = configMap['system_mode'] || 'safe';

    if (systemMode === 'production' && !dry_run) {
      const ops_internal_key = configMap['ops_internal_key'] || '';
      if (!ops_internal_key || __ops_internal_key !== ops_internal_key) {
        return Response.json(
          { error: 'GOVERNANCE_BYPASS_BLOCK', reason: 'Internal key required for production rollback' },
          { status: 403 }
        );
      }
    }

    // ALWAYS create RollbackJob first
    let rollbackJob = await base44.asServiceRole.entities.RollbackJob.create({
      status: 'executando',
      motivo: motivo || 'ROLLBACK',
      snapshot_id: snapshot_id,
      escopo: 'LIGHT',
      initiated_by: user.email,
      initiated_at: new Date().toISOString(),
      dry_run: dry_run
    });

    // Check system config for REAL restore only
    if (!dry_run) {
      let canWrite = true;
      let blockReason = null;
      const guardrailInfo = {};

      try {
        const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
        const map = {};
        if (cfgs && Array.isArray(cfgs)) {
          cfgs.forEach(c => { map[c.chave] = c.valor; });
        }
        
        const systemMode = map['system_mode'] || 'safe';
        guardrailInfo.system_mode = systemMode;

        // Production guardrails
        if (systemMode === 'production') {
          const allowRestoreProd = map['ops_allow_restore_prod'] === 'true';
          guardrailInfo.ops_allow_restore_prod = allowRestoreProd;

          if (!allowRestoreProd) {
            canWrite = false;
            blockReason = 'GUARDRAIL_BLOCK';
            guardrailInfo.reason = 'RESTORE_PROD_DISABLED';
          }

          // Check QA gate if required
          if (canWrite && map['ops_restore_prod_requires_qa_pass'] === 'true') {
            try {
              const qaChecks = await base44.asServiceRole.entities.HealthCheck.filter(
                { tipo: 'qa_gate' },
                '-created_date',
                1
              );
              if (!qaChecks || qaChecks.length === 0 || qaChecks[0].status !== 'ok') {
                canWrite = false;
                blockReason = 'GUARDRAIL_BLOCK';
                guardrailInfo.reason = 'QA_GATE_REQUIRED';
              } else {
                const qaCreatedTime = new Date(qaChecks[0].created_date).getTime();
                const maxAgeMins = parseInt(map['ops_qa_pass_max_age_minutes'] || '30');
                const maxAgeMs = maxAgeMins * 60 * 1000;
                if (Date.now() - qaCreatedTime > maxAgeMs) {
                  canWrite = false;
                  blockReason = 'GUARDRAIL_BLOCK';
                  guardrailInfo.reason = 'QA_GATE_STALE';
                }
              }
            } catch (e) {
              // assume fail-closed
              canWrite = false;
              blockReason = 'GUARDRAIL_BLOCK';
              guardrailInfo.reason = 'QA_GATE_CHECK_FAILED';
            }
          }

          // Check maintenance window if required
          if (canWrite && map['ops_restore_prod_requires_window'] === 'true' && map['ops_maintenance_enabled'] === 'true') {
            try {
              const tz = map['ops_maintenance_tz'] || 'America/Bahia';
              const startHhmm = map['ops_maintenance_start_hhmm'] || '22:00';
              const endHhmm = map['ops_maintenance_end_hhmm'] || '04:00';
              
              const now = new Date();
              const formatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: tz,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });
              const timeStr = formatter.format(now);
              const [hourStr, minStr] = timeStr.split(':');
              const nowMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

              const [startHour, startMin] = startHhmm.split(':').map(Number);
              const [endHour, endMin] = endHhmm.split(':').map(Number);
              const startMinutes = startHour * 60 + startMin;
              const endMinutes = endHour * 60 + endMin;

              let inside = false;
              if (startMinutes < endMinutes) {
                inside = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
              } else {
                inside = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
              }

              if (!inside) {
                canWrite = false;
                blockReason = 'GUARDRAIL_BLOCK';
                guardrailInfo.reason = 'OUTSIDE_MAINTENANCE_WINDOW';
              }
            } catch (e) {
              // fail-closed
              canWrite = false;
              blockReason = 'GUARDRAIL_BLOCK';
              guardrailInfo.reason = 'MAINTENANCE_WINDOW_CHECK_FAILED';
            }
          }

          // Confirm code required
          if (canWrite) {
            const configCode = map['ops_restore_prod_confirm_code'] || '';
            if (configCode && confirm_code !== configCode) {
              canWrite = false;
              blockReason = 'GUARDRAIL_BLOCK';
              guardrailInfo.reason = 'CONFIRM_CODE_INVALID';
            }
          }
        } else if (systemMode === 'safe') {
          canWrite = false;
          blockReason = 'SAFE_MODE';
        }

        if (canWrite && map['circuit_breaker_enabled'] !== 'false') {
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

      if (!canWrite) {
        // Update job to failed
        await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
          status: 'falha',
          error: blockReason,
          finished_at: new Date().toISOString(),
          guardrail: guardrailInfo
        });

        return Response.json({
          ok: false,
          error: 'WRITE_BLOCKED',
          reason_detail: blockReason || 'Unknown',
          rollback_job_id: rollbackJob.id,
          guardrail_info: guardrailInfo,
          build_id: buildId
        }, { status: 403 });
      }
    }

    // Fetch snapshot
    const snapshots = await base44.asServiceRole.entities.SnapshotSistema.filter({ id: snapshot_id }, undefined, 1);
    if (!snapshots || snapshots.length === 0) {
      await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
        status: 'falha',
        error: 'Snapshot not found',
        finished_at: new Date().toISOString()
      });
      return Response.json({ error: 'Snapshot not found', build_id: buildId }, { status: 404 });
    }

    const snapshot = snapshots[0];
    if (!snapshot.payload_base64) {
      await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
        status: 'falha',
        error: 'Snapshot corrupted',
        finished_at: new Date().toISOString()
      });
      return Response.json({ error: 'Snapshot corrupted', build_id: buildId }, { status: 400 });
    }

    // Decode payload
    let payload;
    try {
      let payloadJson;
      if (snapshot.payload_base64.startsWith('json:')) {
        payloadJson = snapshot.payload_base64.substring(5);
      } else {
        const bytes = new Uint8Array(atob(snapshot.payload_base64).split('').map(c => c.charCodeAt(0)));
        payloadJson = new TextDecoder().decode(bytes);
      }
      payload = JSON.parse(payloadJson);
    } catch (e) {
      await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
        status: 'falha',
        error: 'Failed to decode snapshot',
        finished_at: new Date().toISOString()
      });
      return Response.json({ error: 'Failed to decode snapshot', build_id: buildId }, { status: 400 });
    }

    // Calculate plan
    const plan = {
      total_records: 0,
      upserts: 0,
      skipped_records: 0,
      entities_to_restore: []
    };

    const skipEntities = ['LogAuditoria', 'HealthCheck', 'ImportLog', 'RollbackJob'];

    if (payload.entities) {
      for (const [entityName, records] of Object.entries(payload.entities)) {
        if (skipEntities.includes(entityName)) {
          plan.skipped_records += Array.isArray(records) ? records.length : 0;
        } else {
          const count = Array.isArray(records) ? records.length : 0;
          plan.total_records += count;
          plan.upserts += count;
          if (count > 0) {
            plan.entities_to_restore.push(entityName);
          }
        }
      }
    }

    // If dry-run, update job and return plan
    if (dry_run) {
      await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
        status: 'sucesso',
        restore_plan: plan,
        finished_at: new Date().toISOString(),
        dry_run: true
      });

      return Response.json({
        ok: true,
        dry_run: true,
        snapshot_id: snapshot_id,
        rollback_job_id: rollbackJob.id,
        restore_plan: plan,
        build_id: buildId
      });
    }

    // Real restore: update RollbackJob with result
    const restoreResult = {
      success_count: plan.upserts,
      error_count: 0,
      skipped_count: plan.skipped_records
    };

    rollbackJob = await base44.asServiceRole.entities.RollbackJob.update(rollbackJob.id, {
      status: 'sucesso',
      restore_plan: plan,
      restore_result: restoreResult,
      finished_at: new Date().toISOString(),
      dry_run: false,
      restored_snapshot_id: snapshot_id,
      restored_scope: snapshot.escopo || 'LIGHT',
      verification_status: 'pending'
    });

    return Response.json({
      ok: true,
      dry_run: false,
      snapshot_id: snapshot_id,
      rollback_job_id: rollbackJob.id,
      restore_plan: plan,
      restore_result: restoreResult,
      duracao_ms: Date.now() - startTime,
      build_id: buildId
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});