import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { safeJson } from './_utils/safeJson.js';
// touch: redeploy 2026-02-26 18:30:00

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { periodStart, periodEnd, obraId } = await safeJson(req, {});

    // RBAC - permitir admin, programador, admin_empresa (company admin)
    const role = user?.role?.toLowerCase();
    const cargo = user?.cargo?.toLowerCase();
    const perfil = user?.perfil_sistema?.toLowerCase();
    
    // Permitir: superadmin, admin, admin_empresa, executivo, financeiro
    const permitidos = ['admin', 'programador', 'superadmin', 'admin_empresa', 'executivo', 'financeiro', 'diretoria'];
    const isAutorizado = permitidos.includes(role) || permitidos.includes(cargo) || permitidos.includes(perfil);

    if (!isAutorizado) {
      return Response.json({ 
        error: 'Acesso negado',
        message: 'Você não tem permissão para acessar dados financeiros'
      }, { status: 403 });
    }

    // Consultar contas financeiras do período
    let contasQuery = {};
    
    if (periodStart && periodEnd) {
      contasQuery = {
        $and: [
          { $or: [
            { data_vencimento: { $gte: periodStart, $lte: periodEnd } },
            { data_pagamento: { $gte: periodStart, $lte: periodEnd } }
          ]}
        ]
      };
    }

    if (obraId) {
      contasQuery.$and = contasQuery.$and || [];
      contasQuery.$and.push({ obra_id: obraId });
    }

    const contas = await base44.entities.ContaFinanceira.filter(contasQuery);

    // Calcular KPIs
    const aReceberPendente = contas
      .filter(c => c.tipo === 'receber' && c.status === 'pendente')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const aPagarPendente = contas
      .filter(c => c.tipo === 'pagar' && c.status === 'pendente')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const recebidoNoPeriodo = contas
      .filter(c => c.tipo === 'receber' && c.status === 'pago' && c.data_pagamento)
      .reduce((sum, c) => sum + (c.valor_recebido || c.valor || 0), 0);

    const pagoNoPeriodo = contas
      .filter(c => c.tipo === 'pagar' && c.status === 'pago' && c.data_pagamento)
      .reduce((sum, c) => sum + (c.valor_pago || c.valor || 0), 0);

    // Custos por categoria
    const custosPorCategoria = {
      material: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'material').reduce((s, c) => s + (c.valor || 0), 0),
      maoDeObra: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'mao_de_obra').reduce((s, c) => s + (c.valor || 0), 0),
      equipamento: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'equipamento').reduce((s, c) => s + (c.valor || 0), 0),
      transporte: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'transporte').reduce((s, c) => s + (c.valor || 0), 0),
      fretes: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'frete').reduce((s, c) => s + (c.valor || 0), 0),
      servico: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'servico').reduce((s, c) => s + (c.valor || 0), 0),
      impostos: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'imposto').reduce((s, c) => s + (c.valor || 0), 0),
      alimentacao: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'alimentacao').reduce((s, c) => s + (c.valor || 0), 0),
      aluguel: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'aluguel').reduce((s, c) => s + (c.valor || 0), 0),
      outros: contas.filter(c => c.tipo === 'pagar' && c.categoria === 'outros').reduce((s, c) => s + (c.valor || 0), 0)
    };

    const custosOperacionaisTotal = Object.values(custosPorCategoria).reduce((sum, val) => sum + val, 0);
    const custosOperacionaisPeriodo = pagoNoPeriodo;

    const lucroOuPrejuizoPeriodo = recebidoNoPeriodo - pagoNoPeriodo;
    const margemLucro = recebidoNoPeriodo > 0 ? ((lucroOuPrejuizoPeriodo / recebidoNoPeriodo) * 100) : 0;
    const saldoCaixaPeriodo = aReceberPendente - aPagarPendente;

    const statusSaude = lucroOuPrejuizoPeriodo > 0 ? 'saudavel' : lucroOuPrejuizoPeriodo < 0 ? 'prejuizo' : 'neutro';

    // ── Saldo Consolidado REAL da Tesouraria ──
    let saldoConsolidadoTesouraria = 0;
    let contasTesouraria = [];
    try {
      // Usar asServiceRole para garantir acesso a todas as contas
      const contasTesQuery = obraId ? { status: 'ativa', obra_id: obraId } : { status: 'ativa' };
      contasTesouraria = await base44.asServiceRole.entities.ContaTesouraria.filter(contasTesQuery);
      console.log('[getFinanceAdvancedKPIs] Contas tesouraria encontradas:', contasTesouraria?.length || 0);
      
      // Fallback: se filtro por status retornar vazio, buscar todas e filtrar manualmente
      if (!contasTesouraria || contasTesouraria.length === 0) {
        console.log('[getFinanceAdvancedKPIs] Tentando buscar todas as contas sem filtro de status...');
        const todasContas = await base44.asServiceRole.entities.ContaTesouraria.list();
        console.log('[getFinanceAdvancedKPIs] Total de contas (sem filtro):', todasContas?.length || 0);
        contasTesouraria = (todasContas || []).filter(c => !c.status || c.status === 'ativa');
        if (obraId) {
          contasTesouraria = contasTesouraria.filter(c => c.obra_id === obraId);
        }
      }
      
      saldoConsolidadoTesouraria = contasTesouraria.reduce((s, c) => s + (c.saldo_atual || 0), 0);
    } catch (e) {
      console.warn('[getFinanceAdvancedKPIs] ContaTesouraria erro:', e.message);
    }

    const resumoTesouraria = {
      saldoConsolidado: saldoConsolidadoTesouraria,
      qtdContas: contasTesouraria.length,
      totalCaixa: contasTesouraria.filter(c => c.tipo === 'caixa').reduce((s, c) => s + (c.saldo_atual || 0), 0),
      totalBancos: contasTesouraria.filter(c => (c.tipo || '').startsWith('banco_')).reduce((s, c) => s + (c.saldo_atual || 0), 0),
      totalObras: contasTesouraria.filter(c => c.tipo === 'conta_obra').reduce((s, c) => s + (c.saldo_atual || 0), 0),
      contas: contasTesouraria.map(c => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        saldo_atual: c.saldo_atual || 0,
        banco: c.banco || '',
        obra_id: c.obra_id || ''
      }))
    };

    return Response.json({
      kpis: {
        aReceberPendente,
        aPagarPendente,
        recebidoNoPeriodo,
        pagoNoPeriodo,
        custosOperacionaisTotal,
        custosOperacionaisPeriodo,
        custosPorCategoria,
        lucroOuPrejuizoPeriodo,
        margemLucro,
        saldoCaixaPeriodo,
        saldoConsolidadoTesouraria,
        statusSaude
      },
      tesouraria: resumoTesouraria,
      periodo: {
        start: periodStart,
        end: periodEnd
      },
      obraIdUsada: obraId || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro em getFinanceAdvancedKPIs:', error);
    // Retornar 200 com dados zerados para não quebrar o dashboard
    return Response.json({
      kpis: {
        aReceberPendente: 0, aPagarPendente: 0, recebidoNoPeriodo: 0,
        pagoNoPeriodo: 0, custosOperacionaisTotal: 0, custosOperacionaisPeriodo: 0,
        custosPorCategoria: {}, lucroOuPrejuizoPeriodo: 0, margemLucro: 0,
        saldoCaixaPeriodo: 0, saldoConsolidadoTesouraria: 0, statusSaude: 'neutro'
      },
      tesouraria: { saldoConsolidado: 0, qtdContas: 0, totalCaixa: 0, totalBancos: 0, totalObras: 0, contas: [] },
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
});