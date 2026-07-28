import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = 'PROMPT13-2026-02-14-C';
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const snapshot_id = body.snapshot_id;
    const dry_run = body.dry_run !== false;
    const confirm_code = body.confirm_code;
    const __ops_internal_key = body.__ops_internal_key;

    // ANTI-BYPASS CHECK: Production requires internal key
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => { configMap[c.chave] = c.valor; });
    }
    const systemMode = configMap['system_mode'] || 'staging';

    if (systemMode === 'production' && !dry_run) {
      const ops_internal_key = configMap['ops_internal_key'] || '';
      if (!ops_internal_key || __ops_internal_key !== ops_internal_key) {
        return Response.json(
          { error: 'GOVERNANCE_BYPASS_BLOCK', reason: 'Internal key required for production restore', build_id: buildId },
          { status: 403 }
        );
      }
    }

    if (!snapshot_id) {
      return Response.json({ error: 'snapshot_id required' }, { status: 400 });
    }

    // Buscar snapshot específico
    const allSnapshots = await base44.entities.SnapshotSistema.list(undefined, 100);
    const snapshot = allSnapshots && allSnapshots.find(s => s.id === snapshot_id);

    if (!snapshot || !snapshot.payload_base64) {
      return Response.json({ error: 'Snapshot not found or no payload' }, { status: 404 });
    }

    // Decodificar payload
    let jsonData = '';
    try {
      jsonData = atob(snapshot.payload_base64);
      if (!jsonData || jsonData === 'undefined') {
        throw new Error('Invalid payload after decode');
      }
    } catch (e) {
      return Response.json({ error: 'Failed to decode snapshot payload: ' + e.message, build_id: buildId }, { status: 400 });
    }

    // Parse JSON
    let entityMap;
    try {
      entityMap = JSON.parse(jsonData);
    } catch (e) {
      return Response.json({ error: 'Failed to parse snapshot JSON: ' + e.message, build_id: buildId }, { status: 400 });
    }

    // Allowlist: excluir LogAuditoria, HealthCheck por padrão
    const skipEntities = ['LogAuditoria', 'HealthCheck', 'ImportLog'];

    // Planejar restauração (dry-run)
    const plan = {
      total_records: 0,
      upserts: 0,
      skipped_records: 0,
      entities: {}
    };

    for (const [entityName, records] of Object.entries(entityMap)) {
      if (skipEntities.includes(entityName)) {
        const count = records ? records.length : 0;
        plan.entities[entityName] = { count: count, action: 'skip' };
        plan.skipped_records += count;
        continue;
      }

      const count = records ? records.length : 0;
      plan.entities[entityName] = { count: count, action: 'upsert' };
      plan.upserts += count;
      plan.total_records += count;
    }

    // Se dry-run, retorna aqui
    if (dry_run) {
      return Response.json({
        ok: true,
        build_id: buildId,
        snapshot_id: snapshot_id,
        dry_run: true,
        plan: plan,
        duracao_ms: Date.now() - startTime
      });
    }

    // ===== CIRCUIT BREAKER + SAFE MODE + PRODUCTION GUARDRAILS (REAL RESTORE ONLY) =====
    let sysConfig = {};
    const guardrailInfo = {};
    
    try {
      const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      if (cfgs && Array.isArray(cfgs)) {
        cfgs.forEach(c => { sysConfig[c.chave] = c.valor; });
      }
    } catch (e) {
      // ignore
    }

    const systemMode = sysConfig.system_mode || 'staging';
    guardrailInfo.system_mode = systemMode;

    if (systemMode === 'safe') {
      return Response.json({
        error: 'WRITE_BLOCKED',
        reason: 'SAFE_MODE',
        system_mode: systemMode,
        build_id: buildId
      }, { status: 403 });
    }

    // Production guardrails
    if (systemMode === 'production') {
      const allowRestoreProd = sysConfig['ops_allow_restore_prod'] === 'true';
      guardrailInfo.ops_allow_restore_prod = allowRestoreProd;

      if (!allowRestoreProd) {
        return Response.json({
          error: 'GUARDRAIL_BLOCK',
          reason: 'RESTORE_PROD_DISABLED',
          guardrail_info: guardrailInfo,
          build_id: buildId
        }, { status: 403 });
      }

      // Check QA gate if required
      if (sysConfig['ops_restore_prod_requires_qa_pass'] === 'true') {
        try {
          const qaChecks = await base44.asServiceRole.entities.HealthCheck.filter(
            { tipo: 'qa_gate' },
            '-created_date',
            1
          );
          if (!qaChecks || qaChecks.length === 0 || qaChecks[0].status !== 'ok') {
            return Response.json({
              error: 'GUARDRAIL_BLOCK',
              reason: 'QA_GATE_REQUIRED',
              guardrail_info: guardrailInfo,
              build_id: buildId
            }, { status: 403 });
          } else {
            const qaCreatedTime = new Date(qaChecks[0].created_date).getTime();
            const maxAgeMins = parseInt(sysConfig['ops_qa_pass_max_age_minutes'] || '30');
            const maxAgeMs = maxAgeMins * 60 * 1000;
            if (Date.now() - qaCreatedTime > maxAgeMs) {
              return Response.json({
                error: 'GUARDRAIL_BLOCK',
                reason: 'QA_GATE_STALE',
                guardrail_info: guardrailInfo,
                build_id: buildId
              }, { status: 403 });
            }
          }
        } catch (e) {
          return Response.json({
            error: 'GUARDRAIL_BLOCK',
            reason: 'QA_GATE_CHECK_FAILED',
            guardrail_info: guardrailInfo,
            build_id: buildId
          }, { status: 403 });
        }
      }

      // Check maintenance window if required
      if (sysConfig['ops_restore_prod_requires_window'] === 'true' && sysConfig['ops_maintenance_enabled'] === 'true') {
        try {
          const tz = sysConfig['ops_maintenance_tz'] || 'America/Bahia';
          const startHhmm = sysConfig['ops_maintenance_start_hhmm'] || '22:00';
          const endHhmm = sysConfig['ops_maintenance_end_hhmm'] || '04:00';
          
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
            return Response.json({
              error: 'GUARDRAIL_BLOCK',
              reason: 'OUTSIDE_MAINTENANCE_WINDOW',
              guardrail_info: guardrailInfo,
              build_id: buildId
            }, { status: 403 });
          }
        } catch (e) {
          return Response.json({
            error: 'GUARDRAIL_BLOCK',
            reason: 'MAINTENANCE_WINDOW_CHECK_FAILED',
            guardrail_info: guardrailInfo,
            build_id: buildId
          }, { status: 403 });
        }
      }

      // Confirm code required
      const configCode = sysConfig['ops_restore_prod_confirm_code'] || '';
      if (configCode && confirm_code !== configCode) {
        return Response.json({
          error: 'GUARDRAIL_BLOCK',
          reason: 'CONFIRM_CODE_INVALID',
          guardrail_info: guardrailInfo,
          build_id: buildId
        }, { status: 403 });
      }
    }

    const circuitBreakerEnabled = sysConfig.circuit_breaker_enabled !== 'false' && sysConfig.circuit_breaker_enabled !== '0';
    if (circuitBreakerEnabled) {
      try {
        const runtimeErrors = await base44.asServiceRole.entities.HealthCheck.filter(
          { tipo: 'runtime_error', archived: false, is_test: false },
          '-created_date',
          100
        );
        const windowMs = 60 * 60 * 1000;
        const now = Date.now();
        const recentErrors = (runtimeErrors || []).filter(e => {
          try {
            const eTime = new Date(e.created_date).getTime();
            return (now - eTime) <= windowMs;
          } catch {
            return false;
          }
        });
        const criticalCount = recentErrors.filter(e => e.severidade === 'critical').length;
        if (criticalCount > 0 || recentErrors.length >= 8) {
          return Response.json({
            error: 'WRITE_BLOCKED',
            reason: 'CIRCUIT_BREAKER',
            system_mode: systemMode,
            runtime_health: 'critical',
            build_id: buildId
          }, { status: 403 });
        }
      } catch (e) {
        // fail open
      }
    }

    // Restauração REAL (modo upsert com validação)
    const results = {};
    let totalRestored = 0;

    for (const [entityName, records] of Object.entries(entityMap)) {
      if (skipEntities.includes(entityName)) {
        continue;
      }

      results[entityName] = { success: 0, failed: 0 };

      if (records && Array.isArray(records)) {
        for (const record of records) {
          try {
            if (record.id) {
              await base44.asServiceRole.entities[entityName].update(record.id, record);
            } else {
              await base44.asServiceRole.entities[entityName].create(record);
            }
            results[entityName].success++;
            totalRestored++;
          } catch (e) {
            results[entityName].failed++;
          }
        }
      }
    }

    // Criar HealthCheck de restauração
    try {
      await base44.asServiceRole.entities.HealthCheck.create({
        tipo: 'integridade',
        status: 'ok',
        detalhes: {
          restauracao_snapshot: snapshot_id,
          registros_restaurados: totalRestored,
          resultados: results
        },
        duracao_ms: Date.now() - startTime,
        build_id: buildId
      });
    } catch (e) {
      // ignore
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      snapshot_id: snapshot_id,
      dry_run: false,
      plan: plan,
      results: results,
      total_restored: totalRestored,
      verification_status: 'pending',
      duracao_ms: Date.now() - startTime
    });

  } catch (e) {
    return Response.json({ error: e.message, build_id: buildId }, { status: 500 });
  }
});