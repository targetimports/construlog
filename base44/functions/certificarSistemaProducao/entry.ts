import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const BUILD_ID = `CERT-PROD-${Date.now()}`;
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Apenas admin
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        ok: false, 
        error: 'UNAUTHORIZED', 
        message: 'Apenas administradores podem certificar o sistema',
        build_id: BUILD_ID 
      }, { status: 403 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { version_tag, notes, max_qa_age_hours = 24 } = body;
    
    const now = new Date();
    const nowIso = now.toISOString();
    
    // ========================================
    // 1️⃣ VERIFICAR QA GATE
    // ========================================
    const qaChecks = await base44.asServiceRole.entities.HealthCheck.filter({
      tipo: 'qa_gate',
      archived: false
    });
    
    // Ordenar por data mais recente
    const sortedQa = qaChecks.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    );
    
    const latestQa = sortedQa[0];
    
    if (!latestQa) {
      return Response.json({
        ok: false,
        error: 'QA_NOT_VALID',
        message: 'Nenhum registro de QA Gate encontrado. Execute runQaGate primeiro.',
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    // Verificar idade do QA
    const qaAge = (now - new Date(latestQa.created_date)) / (1000 * 60 * 60);
    if (qaAge > max_qa_age_hours) {
      return Response.json({
        ok: false,
        error: 'QA_NOT_VALID',
        message: `QA Gate expirado (${qaAge.toFixed(1)}h > ${max_qa_age_hours}h). Execute runQaGate novamente.`,
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    // Verificar status PASS
    const qaStatus = latestQa.detalhes?.qa_gate_status || latestQa.status;
    if (qaStatus !== 'PASS' && qaStatus !== 'ok') {
      return Response.json({
        ok: false,
        error: 'QA_NOT_VALID',
        message: `QA Gate não passou. Status atual: ${qaStatus}`,
        qa_gate_status: qaStatus,
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    // ========================================
    // 2️⃣ VERIFICAR RUNTIME HEALTH
    // ========================================
    const healthChecks = await base44.asServiceRole.entities.HealthCheck.filter({
      tipo: 'producao',
      archived: false
    });
    
    const sortedHealth = healthChecks.sort((a, b) =>
      new Date(b.created_date) - new Date(a.created_date)
    );
    
    const latestHealth = sortedHealth[0];
    const runtimeStatus = latestHealth?.status || 'ok';
    
    if (runtimeStatus === 'critical') {
      return Response.json({
        ok: false,
        error: 'RUNTIME_UNHEALTHY',
        message: 'Runtime health está crítico. Resolva os problemas antes de certificar.',
        runtime_health_status: runtimeStatus,
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    // ========================================
    // 3️⃣ VERIFICAR GUARDRAILS
    // ========================================
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({});
    const configMap = {};
    configs.forEach(c => { configMap[c.chave] = c.valor; });
    
    const systemMode = configMap['system_mode'];
    const circuitBreakerEnabled = configMap['circuit_breaker_enabled'];
    const opsLocksEnabled = configMap['ops_locks_enabled'] !== 'false';
    const opsApprovalRequired = configMap['ops_approval_required'] !== 'false';
    const safeMode = configMap['safe_mode'] === 'true';
    
    if (safeMode) {
      return Response.json({
        ok: false,
        error: 'GUARDRAILS_NOT_READY',
        message: 'Sistema está em safe_mode. Desative antes de certificar.',
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    if (systemMode !== 'production') {
      return Response.json({
        ok: false,
        error: 'GUARDRAILS_NOT_READY',
        message: `system_mode deve ser "production". Atual: ${systemMode}`,
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    if (!circuitBreakerEnabled) {
      return Response.json({
        ok: false,
        error: 'GUARDRAILS_NOT_READY',
        message: 'circuit_breaker_enabled deve estar configurado.',
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    // Verificar OpsLock ativo conflitante
    const activeLocks = await base44.asServiceRole.entities.OpsLock.filter({
      status: 'ativo'
    });
    
    const validLocks = activeLocks.filter(lock => {
      if (!lock.expires_at_iso) return true;
      return new Date(lock.expires_at_iso) > now;
    });
    
    if (validLocks.length > 0) {
      return Response.json({
        ok: false,
        error: 'GUARDRAILS_NOT_READY',
        message: `Existe(m) ${validLocks.length} OpsLock(s) ativo(s). Aguarde liberação.`,
        active_locks: validLocks.map(l => l.id),
        build_id: BUILD_ID
      }, { status: 403 });
    }
    
    // ========================================
    // IDEMPOTÊNCIA: verificar se já certificado recentemente
    // ========================================
    const existingCerts = await base44.asServiceRole.entities.SystemCertification.filter({});
    const recentCert = existingCerts
      .sort((a, b) => new Date(b.certified_at_iso) - new Date(a.certified_at_iso))[0];
    
    if (recentCert) {
      const certAge = (now - new Date(recentCert.certified_at_iso)) / (1000 * 60);
      // Se certificado há menos de 5 minutos, retorna OK sem duplicar
      if (certAge < 5) {
        return Response.json({
          ok: true,
          certified: true,
          idempotent: true,
          message: 'Sistema já certificado recentemente.',
          build_id: recentCert.build_id,
          snapshot_checkpoint_id: recentCert.snapshot_checkpoint_id,
          certified_at_iso: recentCert.certified_at_iso
        });
      }
    }
    
    // ========================================
    // 4️⃣ CRIAR SNAPSHOT CHECKPOINT FINAL
    // ========================================
    const LIGHT_ENTITIES = [
      'ConfiguracaoSistema',
      'HealthCheck',
      'OpsAprovacao',
      'OpsLock',
      'OpsChangeRequest'
    ];
    
    const snapshotData = {};
    let totalRecords = 0;
    
    for (const entityName of LIGHT_ENTITIES) {
      try {
        const records = await base44.asServiceRole.entities[entityName].filter({});
        snapshotData[entityName] = records;
        totalRecords += records.length;
      } catch (e) {
        snapshotData[entityName] = [];
      }
    }
    
    const payloadStr = JSON.stringify(snapshotData);
    const payloadBase64 = btoa(unescape(encodeURIComponent(payloadStr)));
    
    // Calcular hash
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const snapshotNome = `CERT-CHECKPOINT-${now.toISOString().slice(0, 16).replace(/[:-]/g, '')}`;
    
    const snapshot = await base44.asServiceRole.entities.SnapshotSistema.create({
      nome: snapshotNome,
      escopo: 'LIGHT',
      status: 'criado',
      created_by: user.email,
      created_at_iso: nowIso,
      payload_base64: payloadBase64,
      hash_sha256: hashHex,
      tamanho_bytes: payloadStr.length,
      total_records: totalRecords,
      entities_count: LIGHT_ENTITIES.length,
      pinned: true,
      reason: 'CERTIFICATION_CHECKPOINT',
      tags: ['certification', 'checkpoint', 'pinned'],
      meta: {
        counts: Object.fromEntries(
          Object.entries(snapshotData).map(([k, v]) => [k, v.length])
        ),
        versao_app: BUILD_ID,
        certification: true
      }
    });
    
    // ========================================
    // 5️⃣ CONGELAR CONFIG CRÍTICA
    // ========================================
    const freezeConfigs = [
      { chave: 'config_frozen', valor: 'true' },
      { chave: 'ops_config_locked', valor: 'true' },
      { chave: 'snapshot_retention_locked', valor: 'true' }
    ];
    
    for (const cfg of freezeConfigs) {
      const existing = configs.find(c => c.chave === cfg.chave);
      if (existing) {
        await base44.asServiceRole.entities.ConfiguracaoSistema.update(existing.id, {
          valor: cfg.valor,
          updated_at_iso: nowIso
        });
      } else {
        await base44.asServiceRole.entities.ConfiguracaoSistema.create({
          chave: cfg.chave,
          valor: cfg.valor,
          descricao: `Congelado pela certificação ${BUILD_ID}`,
          created_at_iso: nowIso
        });
      }
    }
    
    // ========================================
    // 6️⃣ CRIAR REGISTRO SystemCertification
    // ========================================
    const certification = await base44.asServiceRole.entities.SystemCertification.create({
      build_id: BUILD_ID,
      certified_at_iso: nowIso,
      certified_by: user.email,
      qa_gate_status: 'PASS',
      runtime_health_status: runtimeStatus,
      guardrails_ok: true,
      snapshot_checkpoint_id: snapshot.id,
      config_frozen: true,
      notes: notes || `Certificação de produção realizada por ${user.email}`,
      version_tag: version_tag || `v${now.toISOString().slice(0, 10)}`
    });
    
    // ========================================
    // 7️⃣ LOG AUDITORIA
    // ========================================
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'SYSTEM_CERTIFIED',
      modulo: 'ops',
      entidade: 'SystemCertification',
      entidade_id: certification.id,
      dados_novos: {
        build_id: BUILD_ID,
        snapshot_checkpoint_id: snapshot.id,
        qa_gate_status: 'PASS',
        runtime_health_status: runtimeStatus,
        config_frozen: true,
        version_tag: version_tag
      },
      detalhes: `Sistema certificado para produção. Build: ${BUILD_ID}, Snapshot: ${snapshot.id}`,
      sucesso: true
    });
    
    // ========================================
    // 8️⃣ RETORNO
    // ========================================
    return Response.json({
      ok: true,
      certified: true,
      build_id: BUILD_ID,
      snapshot_checkpoint_id: snapshot.id,
      certified_at_iso: nowIso,
      certification_id: certification.id,
      version_tag: version_tag || `v${now.toISOString().slice(0, 10)}`,
      guardrails: {
        system_mode: systemMode,
        circuit_breaker_enabled: !!circuitBreakerEnabled,
        ops_locks_enabled: opsLocksEnabled,
        ops_approval_required: opsApprovalRequired
      }
    });
    
  } catch (error) {
    return Response.json({
      ok: false,
      error: 'CERTIFICATION_ERROR',
      message: error.message,
      build_id: BUILD_ID
    }, { status: 500 });
  }
});