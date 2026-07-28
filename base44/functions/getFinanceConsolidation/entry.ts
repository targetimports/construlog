import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { periodStart, periodEnd, obraId, centroCustoId } = await req.json();

    console.log('[Finance Consolidation] Calculando:', { periodStart, periodEnd, obraId });

    const startDate = periodStart ? new Date(periodStart) : null;
    const endDate = periodEnd ? new Date(periodEnd) : null;

    // Helper para filtrar por período
    const filtrarPorPeriodo = (items, dateField = 'created_date') => {
      if (!startDate && !endDate) return items;
      return items.filter(item => {
        const itemDate = new Date(item[dateField]);
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        return true;
      });
    };

    // ============ BUSCAR TODAS AS FONTES DE DADOS ============
    const [
      contasReceber,
      contasPagar,
      materiais,
      maoObra,
      fretes,
      impostos,
      alimentacao,
      alugueis,
      estadias,
      retiradas,
      lancamentos,
      investimentos,
      notasFiscais
    ] = await Promise.all([
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'receber', ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'pagar', ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Material.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.MaoDeObra.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Frete.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Imposto.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Alimentacao.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.AluguelEquipamento.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Estadia.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Retirada.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.LancamentoFinanceiro.filter({ ...(obraId && { obra_id: obraId }) }),
      base44.asServiceRole.entities.Investimento.filter({ ...(obraId && { obra_id: obraId }) }).catch(() => []),
      base44.asServiceRole.entities.NotaFiscal.filter({ ...(obraId && { obra_id: obraId }) }).catch(() => [])
    ]);

    // ============ FILTRAR POR STATUS E PERÍODO ============

    // A RECEBER PENDENTE
    const aReceberPendente = contasReceber
      .filter(c => c.status === 'pendente' || c.status === 'aberto')
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // A PAGAR PENDENTE
    const aPagarPendente = contasPagar
      .filter(c => c.status === 'pendente' || c.status === 'aberto')
      .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // RECEITAS RECEBIDAS NO PERÍODO
    const receitasRecebidas = filtrarPorPeriodo(
      contasReceber.filter(c => c.status === 'pago' || c.status === 'recebido'),
      'data_pagamento'
    );
    const receitaRecebidaTotal = receitasRecebidas.reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    // CUSTOS POR CATEGORIA NO PERÍODO (com anti-duplicidade)
    const custosNoPeriodo = {
      material: filtrarPorPeriodo(materiais.filter(m => m.status !== 'cancelado')).reduce((sum, m) => sum + (parseFloat(m.valor_total) || 0), 0),
      maoDeObra: filtrarPorPeriodo(maoObra.filter(m => m.status !== 'cancelado')).reduce((sum, m) => sum + (parseFloat(m.valor_total) || 0), 0),
      fretes: filtrarPorPeriodo(fretes.filter(f => f.status !== 'cancelado')).reduce((sum, f) => sum + (parseFloat(f.valor_total) || 0), 0),
      impostos: filtrarPorPeriodo(impostos.filter(i => i.status !== 'cancelado')).reduce((sum, i) => sum + (parseFloat(i.valor) || 0), 0),
      alimentacao: filtrarPorPeriodo(alimentacao.filter(a => a.status !== 'cancelado')).reduce((sum, a) => sum + (parseFloat(a.valor_total) || 0), 0),
      aluguelCombustivel: filtrarPorPeriodo(alugueis.filter(a => a.status !== 'cancelado')).reduce((sum, a) => sum + (parseFloat(a.valor_total) || 0), 0),
      estadias: filtrarPorPeriodo(estadias.filter(e => e.status !== 'cancelado')).reduce((sum, e) => sum + (parseFloat(e.valor_total) || 0), 0),
      retiradas: filtrarPorPeriodo(retiradas.filter(r => r.status !== 'cancelado')).reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0),
      investimentos: filtrarPorPeriodo(investimentos.filter(i => i.status !== 'cancelado')).reduce((sum, i) => sum + (parseFloat(i.valor_total) || 0), 0),
      lancamentosGenerico: filtrarPorPeriodo(lancamentos.filter(l => l.status !== 'cancelado')).reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0)
    };

    const custosOperacionaisTotal = Object.values(custosNoPeriodo).reduce((sum, v) => sum + v, 0);

    // SALDO DE CAIXA PERÍODO
    const pagosNoPeriodo = filtrarPorPeriodo(
      contasPagar.filter(c => c.status === 'pago'),
      'data_pagamento'
    ).reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

    const saldoCaixaPeriodo = receitaRecebidaTotal - pagosNoPeriodo;

    // LUCRO/PREJUÍZO
    const lucroOuPrejuizo = receitaRecebidaTotal - custosOperacionaisTotal;
    const margemLucro = receitaRecebidaTotal > 0 ? (lucroOuPrejuizo / receitaRecebidaTotal) * 100 : 0;

    // ============ DEBUG SOURCES ============
    const debugSources = {
      receitas: {
        entidade: 'ContaFinanceira (receber)',
        totalRegistros: receitasRecebidas.length,
        totalSoma: receitaRecebidaTotal,
        exemplos: receitasRecebidas.slice(0, 5).map(r => ({
          id: r.id,
          descricao: r.descricao,
          valor: r.valor,
          status: r.status,
          data: r.data_pagamento
        }))
      },
      custos: {
        material: {
          entidade: 'Material',
          totalRegistros: materiais.filter(m => m.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.material,
          exemplos: filtrarPorPeriodo(materiais.filter(m => m.status !== 'cancelado')).slice(0, 3)
        },
        maoDeObra: {
          entidade: 'MaoDeObra',
          totalRegistros: maoObra.filter(m => m.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.maoDeObra,
          exemplos: filtrarPorPeriodo(maoObra.filter(m => m.status !== 'cancelado')).slice(0, 3)
        },
        fretes: {
          entidade: 'Frete',
          totalRegistros: fretes.filter(f => f.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.fretes
        },
        impostos: {
          entidade: 'Imposto',
          totalRegistros: impostos.filter(i => i.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.impostos
        },
        alimentacao: {
          entidade: 'Alimentacao',
          totalRegistros: alimentacao.filter(a => a.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.alimentacao
        },
        aluguelCombustivel: {
          entidade: 'AluguelEquipamento',
          totalRegistros: alugueis.filter(a => a.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.aluguelCombustivel
        },
        estadias: {
          entidade: 'Estadia',
          totalRegistros: estadias.filter(e => e.status !== 'cancelado').length,
          totalSoma: custosNoPeriodo.estadias
        }
      }
    };

    console.log('[Finance Consolidation] Cálculo concluído', { custosOperacionaisTotal, receitaRecebidaTotal, lucroOuPrejuizo });

    return Response.json({
      success: true,
      period: { start: periodStart, end: periodEnd },
      consolidation: {
        custosOperacionaisTotal: parseFloat(custosOperacionaisTotal.toFixed(2)),
        custosPorCategoria: {
          material: parseFloat(custosNoPeriodo.material.toFixed(2)),
          maoDeObra: parseFloat(custosNoPeriodo.maoDeObra.toFixed(2)),
          fretes: parseFloat(custosNoPeriodo.fretes.toFixed(2)),
          impostos: parseFloat(custosNoPeriodo.impostos.toFixed(2)),
          alimentacao: parseFloat(custosNoPeriodo.alimentacao.toFixed(2)),
          aluguelCombustivel: parseFloat(custosNoPeriodo.aluguelCombustivel.toFixed(2)),
          estadias: parseFloat(custosNoPeriodo.estadias.toFixed(2)),
          retiradas: parseFloat(custosNoPeriodo.retiradas.toFixed(2)),
          investimentos: parseFloat(custosNoPeriodo.investimentos.toFixed(2)),
          lancamentosGenerico: parseFloat(custosNoPeriodo.lancamentosGenerico.toFixed(2))
        },
        receitaRecebidaTotal: parseFloat(receitaRecebidaTotal.toFixed(2)),
        aReceberPendente: parseFloat(aReceberPendente.toFixed(2)),
        aPagarPendente: parseFloat(aPagarPendente.toFixed(2)),
        saldoCaixaPeriodo: parseFloat(saldoCaixaPeriodo.toFixed(2)),
        lucroOuPrejuizo: parseFloat(lucroOuPrejuizo.toFixed(2)),
        margemLucro: parseFloat(margemLucro.toFixed(2))
      },
      debugSources
    });

  } catch (error) {
    console.error('[Finance Consolidation] Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});