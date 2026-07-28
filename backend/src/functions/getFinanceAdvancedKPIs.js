import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// KPIs do Painel Financeiro (Dashboard). Calcula a partir de ContaFinanceira
// (a pagar/receber) e ContaTesouraria (saldos), no período e obra informados.

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const inPeriodo = (d, ini, fim) => !!d && (!ini || d >= ini) && (!fim || d <= fim);

export default async function getFinanceAdvancedKPIs({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const { periodStart, periodEnd, obraId } = body || {};

  let contas = await store.filter('ContaFinanceira', {}, '-data_vencimento', 100000).catch(() => []);
  if (!isGlobal(user)) { const eid = empresaIdDe(user); contas = contas.filter((c) => c.empresa_id === eid); }
  if (obraId) contas = contas.filter((c) => c.obra_id === obraId);

  const pagar = contas.filter((c) => c.tipo === 'pagar');
  const receber = contas.filter((c) => c.tipo === 'receber');
  const ativa = (c) => c.status !== 'cancelado';

  const aPagarPendente = r2(pagar.filter((c) => c.status !== 'pago' && ativa(c)).reduce((s, c) => s + num(c.valor), 0));
  const aReceberPendente = r2(receber.filter((c) => c.status !== 'recebido' && ativa(c)).reduce((s, c) => s + num(c.valor), 0));

  const pagasPeriodo = pagar.filter((c) => c.status === 'pago' && inPeriodo(c.data_pagamento || c.data_vencimento, periodStart, periodEnd));
  const recebidasPeriodo = receber.filter((c) => c.status === 'recebido' && inPeriodo(c.data_recebimento || c.data_vencimento, periodStart, periodEnd));
  const pagoNoPeriodo = r2(pagasPeriodo.reduce((s, c) => s + num(c.valor_pago ?? c.valor), 0));
  const recebidoNoPeriodo = r2(recebidasPeriodo.reduce((s, c) => s + num(c.valor_recebido ?? c.valor), 0));
  const custosOperacionaisPeriodo = pagoNoPeriodo;
  const lucroOuPrejuizoPeriodo = r2(recebidoNoPeriodo - pagoNoPeriodo);

  const catSum = (...termos) => r2(pagasPeriodo
    .filter((c) => termos.some((t) => String(c.categoria || '').toLowerCase().includes(t)))
    .reduce((s, c) => s + num(c.valor), 0));
  const custosPorCategoria = { impostos: catSum('imposto'), alimentacao: catSum('aliment'), aluguel: catSum('alug', 'locac') };

  // Tesouraria
  let tcontas = await store.filter('ContaTesouraria', {}, '-created_date', 5000).catch(() => []);
  if (!isGlobal(user)) { const eid = empresaIdDe(user); tcontas = tcontas.filter((c) => c.empresa_id === eid); }
  const ativas = tcontas.filter((c) => !c.status || c.status === 'ativa');
  const saldoConsolidado = r2(ativas.reduce((s, c) => s + num(c.saldo_atual), 0));
  const tesouraria = {
    saldoConsolidado,
    qtdContas: ativas.length,
    totalCaixa: r2(ativas.filter((c) => c.tipo === 'caixa').reduce((s, c) => s + num(c.saldo_atual), 0)),
    totalBancos: r2(ativas.filter((c) => String(c.tipo || '').startsWith('banco_')).reduce((s, c) => s + num(c.saldo_atual), 0)),
    totalObras: r2(ativas.filter((c) => c.tipo === 'conta_obra').reduce((s, c) => s + num(c.saldo_atual), 0)),
    contas: ativas.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, saldo_atual: num(c.saldo_atual), banco: c.banco || '', obra_id: c.obra_id || '' })),
  };

  const statusSaude = lucroOuPrejuizoPeriodo >= 0 ? 'saudavel' : (aPagarPendente > aReceberPendente ? 'critico' : 'atencao');

  return {
    kpis: {
      aReceberPendente, aPagarPendente, recebidoNoPeriodo, pagoNoPeriodo,
      custosOperacionaisPeriodo, lucroOuPrejuizoPeriodo, statusSaude, custosPorCategoria,
      saldoConsolidadoTesouraria: saldoConsolidado, saldoCaixaPeriodo: saldoConsolidado,
    },
    tesouraria,
  };
}
