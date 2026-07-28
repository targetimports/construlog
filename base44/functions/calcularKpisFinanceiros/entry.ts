/**
 * FONTE ÚNICA DE CÁLCULO DE KPIs FINANCEIROS
 * Usado por: Dashboard Executivo + Financeiro Avançado
 * Garante consistência dos valores em toda a aplicação
 */

export function calcularKpisFinanceiros(contas = [], dataInicio, dataFim, obraId = null) {
  // Filtrar por período
  const contasNoPeriodo = contas.filter(conta => {
    if (!conta.data_vencimento && !conta.data_pagamento) return false;
    
    const dataRef = conta.status === 'pago' ? new Date(conta.data_pagamento) : new Date(conta.data_vencimento);
    if (isNaN(dataRef.getTime())) return false;
    
    if (dataInicio && dataRef < dataInicio) return false;
    if (dataFim && dataRef > dataFim) return false;
    
    return true;
  });

  // Filtrar por obra se informado
  const contasFiltradas = obraId 
    ? contasNoPeriodo.filter(c => c.obra_id === obraId)
    : contasNoPeriodo;

  // A PAGAR (pendente + aberto, não filtrado por período)
  const aPagarPendente = contas
    .filter(c => c.tipo === 'pagar' && (c.status === 'pendente' || c.status === 'aberto') && (!obraId || c.obra_id === obraId))
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

  // A RECEBER (pendente + aberto, não filtrado por período)
  const aReceberPendente = contas
    .filter(c => c.tipo === 'receber' && (c.status === 'pendente' || c.status === 'aberto') && (!obraId || c.obra_id === obraId))
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

  // PAGO NO PERÍODO
  const pagoNoPeriodo = contasFiltradas
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

  // RECEBIDO NO PERÍODO
  const recebidoNoPeriodo = contasFiltradas
    .filter(c => c.tipo === 'receber' && (c.status === 'pago' || c.status === 'recebido'))
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

  // SALDO DE CAIXA NO PERÍODO
  const saldoCaixaPeriodo = recebidoNoPeriodo - pagoNoPeriodo;

  // CUSTOS OPERACIONAIS (no período)
  const custosOperacionaisTotal = contasFiltradas
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((sum, c) => sum + (parseFloat(c.valor) || 0), 0);

  // LUCRO/PREJUÍZO NO PERÍODO
  const lucroOuPrejuizoPeriodo = recebidoNoPeriodo - custosOperacionaisTotal;
  const margemLucro = recebidoNoPeriodo > 0 ? (lucroOuPrejuizoPeriodo / recebidoNoPeriodo) * 100 : 0;

  return {
    aPagarPendente: parseFloat(aPagarPendente.toFixed(2)),
    aReceberPendente: parseFloat(aReceberPendente.toFixed(2)),
    pagoNoPeriodo: parseFloat(pagoNoPeriodo.toFixed(2)),
    recebidoNoPeriodo: parseFloat(recebidoNoPeriodo.toFixed(2)),
    saldoCaixaPeriodo: parseFloat(saldoCaixaPeriodo.toFixed(2)),
    custosOperacionaisTotal: parseFloat(custosOperacionaisTotal.toFixed(2)),
    lucroOuPrejuizoPeriodo: parseFloat(lucroOuPrejuizoPeriodo.toFixed(2)),
    margemLucro: parseFloat(margemLucro.toFixed(2))
  };
}