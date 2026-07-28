import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função backend única para calcular KPIs financeiros
 * Usada por Dashboard e Financeiro Avançado
 * Garante fonte única de verdade para números financeiros
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { startDate, endDate, obraId } = body;

    console.log('💰 Calculando KPIs unificados:', { startDate, endDate, obraId });

    // Buscar todas as contas financeiras
    const contas = await base44.asServiceRole.entities.ContaFinanceira.list('-data_vencimento', 1000);

    if (!contas || contas.length === 0) {
      console.warn('⚠️ Nenhuma conta financeira encontrada');
      return Response.json({
        kpis: {
          aReceberPendente: 0,
          aPagarPendente: 0,
          recebidoNoPeriodo: 0,
          pagoNoPeriodo: 0,
          saldoCaixaPeriodo: 0,
          custosOperacionaisPeriodo: 0,
          lucroOuPrejuizoPeriodo: 0,
          statusSaude: 'indisponivel'
        },
        meta: { startDate, endDate, obraId, contasTotal: 0 }
      });
    }

    // Filtrar por obra se fornecida
    const contasFiltradas = obraId 
      ? contas.filter(c => c.obra_id === obraId)
      : contas;

    // Converter datas para comparação
    const dtStart = new Date(`${startDate}T00:00:00`);
    const dtEnd = new Date(`${endDate}T23:59:59`);

    console.log(`📊 Processando ${contasFiltradas.length} contas (filtro obra: ${obraId || 'todas'})`);

    // 1. CONTAS A RECEBER (pendentes, sem filtro de data)
    const aReceberPendente = contasFiltradas
      .filter(c => c.tipo === 'receber' && (c.status === 'pendente' || c.status === 'aberto'))
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    // 2. CONTAS A PAGAR (pendentes, sem filtro de data)
    const aPagarPendente = contasFiltradas
      .filter(c => c.tipo === 'pagar' && (c.status === 'pendente' || c.status === 'aberto'))
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    // 3. RECEBIDO NO PERÍODO (status pago + data_pagamento no período)
    const recebidoNoPeriodo = contasFiltradas
      .filter(c => {
        if (c.tipo !== 'receber') return false;
        if (c.status !== 'pago' && c.status !== 'recebido') return false;
        if (!c.data_pagamento) return false;
        const dtPagamento = new Date(`${c.data_pagamento}T00:00:00`);
        return dtPagamento >= dtStart && dtPagamento <= dtEnd;
      })
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    // 4. PAGO NO PERÍODO (status pago + data_pagamento no período)
    const pagoNoPeriodo = contasFiltradas
      .filter(c => {
        if (c.tipo !== 'pagar') return false;
        if (c.status !== 'pago') return false;
        if (!c.data_pagamento) return false;
        const dtPagamento = new Date(`${c.data_pagamento}T00:00:00`);
        return dtPagamento >= dtStart && dtPagamento <= dtEnd;
      })
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    // 5. SALDO DE CAIXA = total recebido acumulado - total pago acumulado (até a data final)
    const totalRecebidoAcumulado = contasFiltradas
      .filter(c => {
        if (c.tipo !== 'receber') return false;
        if (c.status !== 'pago' && c.status !== 'recebido') return false;
        if (!c.data_pagamento) return false;
        const dtPagamento = new Date(`${c.data_pagamento}T00:00:00`);
        return dtPagamento <= dtEnd;
      })
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const totalPagoAcumulado = contasFiltradas
      .filter(c => {
        if (c.tipo !== 'pagar') return false;
        if (c.status !== 'pago') return false;
        if (!c.data_pagamento) return false;
        const dtPagamento = new Date(`${c.data_pagamento}T00:00:00`);
        return dtPagamento <= dtEnd;
      })
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const saldoCaixaPeriodo = totalRecebidoAcumulado - totalPagoAcumulado;

    // 6. CUSTOS OPERACIONAIS NO PERÍODO = pago no período (todas as despesas)
    const custosOperacionaisPeriodo = pagoNoPeriodo;

    // 7. LUCRO/PREJUÍZO NO PERÍODO = recebido - pago
    const lucroOuPrejuizoPeriodo = recebidoNoPeriodo - pagoNoPeriodo;

    // 8. STATUS DE SAÚDE
    let statusSaude = 'saudavel';
    if (aPagarPendente > aReceberPendente * 0.8 || saldoCaixaPeriodo < 0) {
      statusSaude = 'atencao';
    }
    if (aPagarPendente > aReceberPendente * 2 || saldoCaixaPeriodo < -50000) {
      statusSaude = 'critico';
    }

    console.log(`✅ KPIs calculados:
      - A Receber: R$ ${aReceberPendente.toFixed(2)}
      - A Pagar: R$ ${aPagarPendente.toFixed(2)}
      - Recebido (período): R$ ${recebidoNoPeriodo.toFixed(2)}
      - Pago (período): R$ ${pagoNoPeriodo.toFixed(2)}
      - Saldo Caixa: R$ ${saldoCaixaPeriodo.toFixed(2)}
      - Lucro/Prejuízo: R$ ${lucroOuPrejuizoPeriodo.toFixed(2)}
      - Status: ${statusSaude}
    `);

    return Response.json({
      kpis: {
        aReceberPendente,
        aPagarPendente,
        recebidoNoPeriodo,
        pagoNoPeriodo,
        saldoCaixaPeriodo,
        custosOperacionaisPeriodo,
        lucroOuPrejuizoPeriodo,
        statusSaude
      },
      meta: { 
        startDate, 
        endDate, 
        obraId,
        contasTotal: contas.length,
        contasFiltradas: contasFiltradas.length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao calcular KPIs:', error);
    return Response.json({
      error: error.message,
      kpis: {
        aReceberPendente: 0,
        aPagarPendente: 0,
        recebidoNoPeriodo: 0,
        pagoNoPeriodo: 0,
        saldoCaixaPeriodo: 0,
        custosOperacionaisPeriodo: 0,
        lucroOuPrejuizoPeriodo: 0,
        statusSaude: 'erro'
      }
    }, { status: 500 });
  }
});