import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BUILD_ID = `PAGAR-v2-${Date.now()}`;

async function logAuditoria(base44, userData, acao, modulo, entidade, entidade_id, detalhes) {
  try {
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: userData.email,
      acao,
      modulo,
      entidade,
      entidade_id,
      detalhes: JSON.stringify(detalhes),
      sucesso: true
    });
  } catch (err) {
    console.log('[AUDITORIA-ERRO]', err.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validar permissões
    const userRole = user.cargo || user.role || 'leitura';
    const hasPermission = ['diretor', 'financeiro', 'admin'].includes(userRole) || user.role === 'admin';
    
    if (!hasPermission) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // ===== CIRCUIT BREAKER + SAFE MODE CHECK =====
    let sysConfig = {};
    try {
      const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
      if (cfgs && Array.isArray(cfgs)) {
        cfgs.forEach(c => { sysConfig[c.chave] = c.valor; });
      }
    } catch (e) {
      // ignore
    }

    const systemMode = sysConfig.system_mode || 'staging';
    if (systemMode === 'safe') {
      return Response.json({
        error: 'WRITE_BLOCKED',
        reason: 'SAFE_MODE',
        system_mode: systemMode
      }, { status: 403 });
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
            runtime_health: 'critical'
          }, { status: 403 });
        }
      } catch (e) {
        // fail open
      }
    }

    const { conta_id, data_pagamento, forma_pagamento, valor_pago } = await req.json();

    if (!conta_id) {
      return Response.json({ error: 'Parâmetro faltando: conta_id' }, { status: 400 });
    }

    // 1. Ler ContaFinanceira
    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contas || contas.length === 0) {
      return Response.json({ error: 'Conta não encontrada', build_id: BUILD_ID }, { status: 404 });
    }

    const conta = contas[0];

    // Validar tipo
    if (conta.tipo !== 'pagar') {
      return Response.json({
        error: 'Esta função só processa contas a pagar',
        tipo_conta: conta.tipo
      }, { status: 400 });
    }

    // 2. Verificar Aprovacao pendente (hardening: impede bypass mesmo se status foi alterado manualmente)
    const aprovacoesPendentes = await base44.asServiceRole.entities.Aprovacao.filter({
      modulo: 'financeiro',
      referencia_tipo: 'ContaFinanceira',
      referencia_id: conta_id,
      status: 'pendente'
    }, undefined, 1);

    if (aprovacoesPendentes && aprovacoesPendentes.length > 0) {
      return Response.json({
        error: 'Pagamento bloqueado: aguardando aprovação (pendência encontrada)',
        status_atual: conta.status,
        aprovacao_id: aprovacoesPendentes[0].id
      }, { status: 403 });
    }

    // 3. Bloqueios de alçada (status de conta)
    if (conta.status === 'em_aprovacao') {
      return Response.json({
        error: 'Pagamento bloqueado: aguardando aprovação',
        status_atual: conta.status
      }, { status: 403 });
    }

    if (conta.status === 'reprovada') {
      return Response.json({
        error: 'Pagamento bloqueado: pagamento reprovado',
        status_atual: conta.status
      }, { status: 403 });
    }

    // 4. Validar idempotência
    if (conta.status === 'pago') {
      return Response.json({
        error: 'Conta já foi paga',
        build_id: BUILD_ID
      }, { status: 400 });
    }

    // 5. Executar pagamento
    const agora = new Date().toISOString();
    const dataPag = data_pagamento ? new Date(data_pagamento).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const valorPago = valor_pago !== undefined ? valor_pago : conta.valor;

    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, {
      status: 'pago',
      data_pagamento: dataPag,
      forma_pagamento: forma_pagamento || conta.forma_pagamento || 'transferencia',
      valor_pago: valorPago
    });

    // 6. Persistência: validar
    const contaCheck = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contaCheck || contaCheck.length === 0 || contaCheck[0].status !== 'pago') {
      return Response.json({
        error: 'PERSISTENCE_FAILED',
        build_id: BUILD_ID,
        stage: 'conta_check'
      }, { status: 500 });
    }

    // 7. Auditoria
    await logAuditoria(base44, user, 'pagar_conta', 'financeiro', 'ContaFinanceira', conta_id, {
      conta_id,
      data_pagamento: dataPag,
      forma_pagamento,
      valor_pago: valorPago,
      pago_por: user.email
    });

    return Response.json({
      ok: true,
      build_id: BUILD_ID,
      conta_id,
      status_conta: 'pago',
      data_pagamento: dataPag,
      timestamp: agora
    });

  } catch (error) {
    console.error('[PAGAR-ERRO]', error);
    return Response.json({ error: error.message, build_id: BUILD_ID }, { status: 500 });
  }
});