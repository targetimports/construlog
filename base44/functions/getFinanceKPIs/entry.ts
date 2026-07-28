import { withSecureHandler } from './_shared/secureHandler.ts';
import { successResponse } from './_shared/responseHandler.ts';

Deno.serve(async (req) => {
  return withSecureHandler(req, {
    requiredPermission: 'FINANCEIRO_VISUALIZAR_KPIS',
    validateInput: (data) => ({ valid: true }),
    auditAction: 'CALCULAR_KPIS_FINANCEIRO'
  }, async (ctx) => {
    const { base44, payload } = ctx;
    const { periodStart, periodEnd, obraId, centroCustoId } = payload;

    console.log('[Finance KPIs] Calculando KPIs:', { periodStart, periodEnd, obraId, centroCustoId });

    // Filtro de período (se especificado)
    const startDate = periodStart ? new Date(periodStart) : null;
    const endDate = periodEnd ? new Date(periodEnd) : null;

    // ============ BUSCAR DADOS ============
    
    // Contas a Receber com filtro de escopo
    const filtroReceber = { tipo: 'receber' };
    if (obraId) filtroReceber.obra_id = obraId;
    if (centroCustoId) filtroReceber.centro_custo_id = centroCustoId;
    const contasReceber = await base44.asServiceRole.entities.ContaFinanceira.filter(filtroReceber);

    // Contas a Pagar com filtro de escopo
    const filtroPagar = { tipo: 'pagar' };
    if (obraId) filtroPagar.obra_id = obraId;
    if (centroCustoId) filtroPagar.centro_custo_id = centroCustoId;
    const contasPagar = await base44.asServiceRole.entities.ContaFinanceira.filter(filtroPagar);

    // Receitas das Obras
    const receitas = await base44.asServiceRole.entities.ReceitaObra.filter({
      ...(obraId && { obra_id: obraId })
    });

    // Lançamentos Financeiros (gastos diversos)
    const lancamentos = await base44.asServiceRole.entities.LancamentoFinanceiro.filter({
      ...(obraId && { obra_id: obraId })
    });

    // Material, Mão de Obra, Fretes, etc
    const materiais = await base44.asServiceRole.entities.Material.filter({
      ...(obraId && { obra_id: obraId })
    });

    const maoObra = await base44.asServiceRole.entities.MaoDeObra.filter({
      ...(obraId && { obra_id: obraId })
    });

    const fretes = await base44.asServiceRole.entities.Frete.filter({
      ...(obraId && { obra_id: obraId })
    });

    const impostos = await base44.asServiceRole.entities.Imposto.filter({
      ...(obraId && { obra_id: obraId })
    });

    const alimentacao = await base44.asServiceRole.entities.Alimentacao.filter({
      ...(obraId && { obra_id: obraId })
    });

    const alugueis = await base44.asServiceRole.entities.AluguelEquipamento.filter({
      ...(obraId && { obra_id: obraId })
    });

    const estadias = await base44.asServiceRole.entities.Estadia.filter({
      ...(obraId && { obra_id: obraId })
    });

    const retiradas = await base44.asServiceRole.entities.Retirada.filter({
      ...(obraId && { obra_id: obraId })
    });

    // ============ FILTRAR POR PERÍODO ============
    
    const filtrarPorPeriodo = (items, dateField = 'created_date') => {
      if (!startDate && !endDate) return items;
      return items.filter(item => {
        const itemDate = new Date(item[dateField]);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    };

    // ============ CÁLCULOS ============

    // A RECEBER (PENDENTE)
    const aReceberPendente = contasReceber
      .filter(c => c.status === 'pendente' || c.status === 'aberto')
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // A PAGAR (PENDENTE)
    const aPagarPendente = contasPagar
      .filter(c => c.status === 'pendente' || c.status === 'aberto')
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // RECEBIDO NO PERÍODO
    const recebidoNoPeriodo = filtrarPorPeriodo(
      contasReceber.filter(c => c.status === 'pago' || c.status === 'recebido'),
      'data_pagamento'
    ).reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // PAGO NO PERÍODO
    const pagoNoPeriodo = filtrarPorPeriodo(
      contasPagar.filter(c => c.status === 'pago'),
      'data_pagamento'
    ).reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // SALDO DE CAIXA (A Receber Pendente - A Pagar Pendente)
    const saldoCaixa = aReceberPendente - aPagarPendente;

    // RECEITA FATURADA (do período)
    const receitaFaturada = filtrarPorPeriodo(
      receitas.filter(r => r.status === 'faturado' || r.status === 'recebido'),
      'data_faturamento'
    ).reduce((sum, r) => sum + (parseFloat(r.valor_liquido || r.valor_bruto) || 0), 0);

    // CUSTOS TOTAIS NO PERÍODO
    const custoMateriais = filtrarPorPeriodo(materiais).reduce((sum, m) => sum + (parseFloat(m.valor_total) || 0), 0);
    const custoMaoObra = filtrarPorPeriodo(maoObra).reduce((sum, m) => sum + (parseFloat(m.valor_total) || 0), 0);
    const custoFretes = filtrarPorPeriodo(fretes).reduce((sum, f) => sum + (parseFloat(f.valor_total) || 0), 0);
    const custoImpostos = filtrarPorPeriodo(impostos).reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0);
    const custoAlimentacao = filtrarPorPeriodo(alimentacao).reduce((sum, a) => sum + (parseFloat(a.valor_total) || 0), 0);
    const custoAlugueis = filtrarPorPeriodo(alugueis).reduce((sum, a) => sum + (parseFloat(a.valor_total) || 0), 0);
    const custoEstadias = filtrarPorPeriodo(estadias).reduce((sum, e) => sum + (parseFloat(e.valor_total) || 0), 0);
    const custoRetiradas = filtrarPorPeriodo(retiradas).reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const custoLancamentos = filtrarPorPeriodo(lancamentos).reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);

    const totalCustos = custoMateriais + custoMaoObra + custoFretes + custoImpostos + 
                        custoAlimentacao + custoAlugueis + custoEstadias + custoRetiradas + custoLancamentos;

    // LUCRO (Receita Faturada - Custos Totais)
    const lucroNoPeriodo = receitaFaturada - totalCustos;
    const margemLucro = receitaFaturada > 0 ? (lucroNoPeriodo / receitaFaturada) * 100 : 0;

    // ORÇADO vs REALIZADO (se houver obra)
    let custoOrcado = 0;
    let variacaoCusto = 0;

    if (obraId) {
      const orcamentos = await base44.asServiceRole.entities.OrcamentoObra.filter({ obra_id: obraId });
      custoOrcado = orcamentos.reduce((sum, o) => sum + (parseFloat(o.valor_total) || 0), 0);
      if (custoOrcado > 0) {
        variacaoCusto = ((totalCustos - custoOrcado) / custoOrcado) * 100;
      }
    }

    return {
      period: { start: periodStart, end: periodEnd },
      kpis: {
        aReceberPendente: parseFloat(aReceberPendente.toFixed(2)),
        aPagarPendente: parseFloat(aPagarPendente.toFixed(2)),
        recebidoNoPeriodo: parseFloat(recebidoNoPeriodo.toFixed(2)),
        pagoNoPeriodo: parseFloat(pagoNoPeriodo.toFixed(2)),
        saldoCaixa: parseFloat(saldoCaixa.toFixed(2)),
        receitaFaturada: parseFloat(receitaFaturada.toFixed(2)),
        totalCustos: parseFloat(totalCustos.toFixed(2)),
        lucroNoPeriodo: parseFloat(lucroNoPeriodo.toFixed(2)),
        margemLucro: parseFloat(margemLucro.toFixed(2)),
        custoOrcado: parseFloat(custoOrcado.toFixed(2)),
        variacaoCusto: parseFloat(variacaoCusto.toFixed(2))
      },
      detalhes: {
        custoMateriais: parseFloat(custoMateriais.toFixed(2)),
        custoMaoObra: parseFloat(custoMaoObra.toFixed(2)),
        custoFretes: parseFloat(custoFretes.toFixed(2)),
        custoImpostos: parseFloat(custoImpostos.toFixed(2)),
        custoAlimentacao: parseFloat(custoAlimentacao.toFixed(2)),
        custoAlugueis: parseFloat(custoAlugueis.toFixed(2)),
        custoEstadias: parseFloat(custoEstadias.toFixed(2)),
        custoRetiradas: parseFloat(custoRetiradas.toFixed(2)),
        custoLancamentos: parseFloat(custoLancamentos.toFixed(2))
      }
    };
  });
});