import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const build_id = Math.random().toString(36).substr(2, 9);
  let tentativa = 0;
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    const { medicao_id } = await req.json();

    if (!medicao_id) return Response.json({ error: 'medicao_id obrigatório' }, { status: 400 });

    // RULE 1: Sempre usar get() para leitura de 1 registro
    const medicaoAtual = await base44.asServiceRole.entities.MedicaoContrato.get(medicao_id);
    if (!medicaoAtual) return Response.json({ error: 'Medição não encontrada' }, { status: 404 });

    const status_before = medicaoAtual.status;

    if (medicaoAtual.status !== 'aprovada') {
      return Response.json({ 
        error: 'Medição deve estar aprovada',
        expected: 'aprovada',
        got: medicaoAtual.status,
        build_id,
        status_before
      }, { status: 400 });
    }

    // Carregar contrato para pegar categoria_id
    const contrato = await base44.asServiceRole.entities.Contrato.get(medicaoAtual.contrato_id);
    if (!contrato) return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });

    // Criar ContaFinanceira tipo=pagar com referência medicao_contrato
    // RULE 4: valor_liquido NUNCA bruto
    const conta = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'pagar',
      descricao: `Faturamento Contrato ${contrato.numero} - ${medicaoAtual.titulo}`,
      valor: medicaoAtual.valor_liquido,
      data_vencimento: medicaoAtual.periodo_ate || new Date().toISOString().split('T')[0],
      status: 'pendente',
      obra_id: medicaoAtual.obra_id,
      categoria: contrato.categoria_id ? 'servico' : 'outros',
      categoria_id: contrato.categoria_id,
      fornecedor_cliente: contrato.contratado,
      referencia_tipo: 'medicao_contrato',
      referencia_id: medicao_id,
      observacao: `Medição ${medicaoAtual.numero}`
    });

    // RULE 2: Retry loop para garantir persistência
    let medicaoAtualizada = null;
    let status_after = null;
    
    for (tentativa = 1; tentativa <= 2; tentativa++) {
      const dataAgora = new Date().toISOString();
      medicaoAtualizada = await base44.asServiceRole.entities.MedicaoContrato.update(medicao_id, {
        status: 'faturada',
        data_faturamento: dataAgora,
        conta_pagar_id: conta.id
      });

      // RULE 2 + 4: Confirmar persistência com get() e validar conta_pagar_id
      const medicaoConfirm = await base44.asServiceRole.entities.MedicaoContrato.get(medicao_id);
      
      if (medicaoConfirm && 
          medicaoConfirm.status === 'faturada' && 
          medicaoConfirm.conta_pagar_id === conta.id) {
        status_after = medicaoConfirm.status;
        medicaoAtualizada = medicaoConfirm;
        break;
      }
      
      if (tentativa === 2) {
        return Response.json({
          error: 'PERSISTENCE_FAILED',
          message: 'Falha na persistência do faturamento após 2 tentativas',
          build_id,
          tentativa,
          status_before,
          status_after: medicaoConfirm?.status,
          conta_pagar_id_expected: conta.id,
          conta_pagar_id_got: medicaoConfirm?.conta_pagar_id
        }, { status: 500 });
      }
    }

    // Auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'faturar',
      modulo: 'contratos',
      entidade: 'MedicaoContrato',
      entidade_id: medicao_id,
      dados_anteriores: medicaoAtual,
      dados_novos: medicaoAtualizada,
      detalhes: `Medição faturada: ${medicaoAtualizada.titulo} - Conta ${conta.id}`,
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      medicao: medicaoAtualizada, 
      conta_id: conta.id,
      build_id,
      tentativa,
      status_before,
      status_after
    });
  } catch (error) {
    return Response.json({ error: error.message, build_id, tentativa }, { status: 500 });
  }
});