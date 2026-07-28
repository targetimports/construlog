import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const BUILD_ID = `VERIFY-CERT-${Date.now()}`;
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        error: 'UNAUTHORIZED',
        build_id: BUILD_ID 
      }, { status: 401 });
    }
    
    const now = new Date();
    
    // Buscar certificações
    const certifications = await base44.asServiceRole.entities.SystemCertification.filter({});
    const sorted = certifications.sort((a, b) => 
      new Date(b.certified_at_iso) - new Date(a.certified_at_iso)
    );
    
    const lastCert = sorted[0];
    
    if (!lastCert) {
      return Response.json({
        ok: true,
        certified_exists: false,
        status: 'NOT_CERTIFIED',
        last_certification: null,
        build_id: BUILD_ID
      });
    }
    
    // Calcular idade
    const certDate = new Date(lastCert.certified_at_iso);
    const ageMinutes = Math.round((now - certDate) / (1000 * 60));
    const ageHours = Math.round(ageMinutes / 60);
    const ageDays = Math.round(ageHours / 24);
    
    // Verificar QA Gate atual
    const qaChecks = await base44.asServiceRole.entities.HealthCheck.filter({
      tipo: 'qa_gate',
      archived: false
    });
    const latestQa = qaChecks.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    )[0];
    const currentQaStatus = latestQa?.detalhes?.qa_gate_status || latestQa?.status || 'unknown';
    
    // Verificar runtime health atual
    const healthChecks = await base44.asServiceRole.entities.HealthCheck.filter({
      tipo: 'producao',
      archived: false
    });
    const latestHealth = healthChecks.sort((a, b) =>
      new Date(b.created_date) - new Date(a.created_date)
    )[0];
    const currentRuntimeHealth = latestHealth?.status || 'unknown';
    
    // Verificar config frozen
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({});
    const configMap = {};
    configs.forEach(c => { configMap[c.chave] = c.valor; });
    const configFrozen = configMap['config_frozen'] === 'true';
    
    // Determinar status
    let status = 'CERTIFIED';
    const warnings = [];
    
    // Certificação expira após 30 dias
    if (ageDays > 30) {
      status = 'EXPIRED';
      warnings.push(`Certificação tem ${ageDays} dias (máximo 30)`);
    }
    
    // Verificar se QA ainda é válido
    if (currentQaStatus !== 'PASS' && currentQaStatus !== 'ok') {
      warnings.push(`QA Gate atual: ${currentQaStatus}`);
    }
    
    // Verificar runtime
    if (currentRuntimeHealth === 'critical') {
      status = 'DEGRADED';
      warnings.push('Runtime health crítico');
    }
    
    return Response.json({
      ok: true,
      certified_exists: true,
      status,
      warnings: warnings.length > 0 ? warnings : undefined,
      last_certification: {
        id: lastCert.id,
        build_id: lastCert.build_id,
        certified_at_iso: lastCert.certified_at_iso,
        certified_by: lastCert.certified_by,
        version_tag: lastCert.version_tag,
        qa_gate_status: lastCert.qa_gate_status,
        runtime_health_status: lastCert.runtime_health_status,
        snapshot_checkpoint_id: lastCert.snapshot_checkpoint_id,
        config_frozen: lastCert.config_frozen
      },
      current_state: {
        qa_gate_status: currentQaStatus,
        runtime_health: currentRuntimeHealth,
        config_frozen: configFrozen
      },
      age: {
        minutes: ageMinutes,
        hours: ageHours,
        days: ageDays
      },
      total_certifications: certifications.length,
      build_id: BUILD_ID
    });
    
  } catch (error) {
    return Response.json({
      ok: false,
      error: 'VERIFY_ERROR',
      message: error.message,
      build_id: BUILD_ID
    }, { status: 500 });
  }
});