import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
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

    const payload = await req.json();
    const { medicao_id, cliente_id, categoria_nome, centro_custo_id, data_vencimento } = payload;

    if (!medicao_id) {
      return Response.json({ error: 'Field medicao_id is required' }, { status: 400 });
    }

    // Buscar medição
    const medicaoList = await base44.entities.MedicaoObra.filter({ id: medicao_id });
    if (!medicaoList || medicaoList.length === 0) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    const medicao = medicaoList[0];

    // Validar status
    if (medicao.status !== 'aprovada') {
      return Response.json({ 
        error: `Medição deve estar em status 'aprovada' para faturar. Status atual: '${medicao.status}'` 
      }, { status: 400 });
    }

    // Buscar ou criar categoria de receita
    let categoria_id = null;
    const categoriaNome = categoria_nome || 'Receita de Obra';
    const categoriaList = await base44.entities.CategoriaFinanceira.filter({ 
      nome: categoriaNome 
    });

    if (categoriaList && categoriaList.length > 0) {
      categoria_id = categoriaList[0].id;
    } else {
      const novaCategoria = await base44.entities.CategoriaFinanceira.create({
        nome: categoriaNome,
        tipo: 'receita',
        grupo: 'servico',
        ativo: true
      });
      categoria_id = novaCategoria.id;
    }

    // CORREÇÃO: Garantir obra_id obrigatório na ContaFinanceira
    if (!medicao.obra_id) {
      return Response.json({ 
        error: 'Medição deve ter obra_id vinculada para faturamento' 
      }, { status: 400 });
    }

    // Criar ContaFinanceira tipo receber
    const conta = await base44.entities.ContaFinanceira.create({
      descricao: `Faturamento Medição ${medicao.numero} - Obra`,
      valor: medicao.valor_total_medido,
      valor_recebido: 0,
      data_vencimento: data_vencimento || new Date().toISOString().split('T')[0],
      tipo: 'receber',
      status: 'pendente',
      obra_id: medicao.obra_id,
      cliente_id: cliente_id || null,
      categoria: categoria_id || 'Receita de Obra',
      centro_custo: centro_custo_id || null,
      referencia_tipo: 'medicao_obra',
      referencia_id: medicao_id,
      forma_pagamento: 'transferencia',
      observacao: `Gerada automaticamente da Medição de Obra ${medicao.numero}`,
      fornecedor_cliente: 'Cliente - Medição de Obra'
    });

    // Atualizar medição para faturada
    const medicaoAtualizada = await base44.entities.MedicaoObra.update(medicao_id, {
      status: 'faturada'
    });

    // Log auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'faturar',
      modulo: 'medicao',
      entidade: 'MedicaoObra',
      entidade_id: medicao_id,
      dados_anteriores: { status: 'aprovada' },
      dados_novos: { status: 'faturada', conta_receber_id: conta.id },
      sucesso: true
    });

    return Response.json({ 
      ok: true, 
      medicao: medicaoAtualizada,
      conta: conta,
      message: 'Medição faturada com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});