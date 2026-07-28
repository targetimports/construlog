import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { podeAcessarObra } from '../escopoObra.js';

// Consolidação financeira por obra: realizado vs previsto (receita/despesa/saldo) + breakdowns.
// Modelo deste sistema: ContaFinanceira tipo 'receber'/'pagar';
//   realizado: pagar->status 'pago' | receber->status 'recebido'. previsto: status 'pendente'.
const num = (x) => Number(x) || 0;
const r2 = (x) => Math.round(num(x) * 100) / 100;
const inc = (tipo, alvo) => tipo === 'AMBOS' || tipo === alvo;

export default async function consolidarFinanceiroCompleto({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');

  const { obra_id, data_inicio, data_fim, tipo = 'AMBOS' } = body || {};
  if (!obra_id || !data_inicio || !data_fim) {
    return { success: false, error: 'Parâmetros obrigatórios: obra_id, data_inicio, data_fim' };
  }
  // Isolamento multi-empresa (fail-closed): usuário só consolida obra da própria empresa.
  if (!(await podeAcessarObra(user, obra_id))) {
    return { success: false, error: 'Sem acesso a esta obra (outra empresa)' };
  }

  const dentro = (d) => {
    if (!d) return false;
    const ds = String(d).slice(0, 10);
    return ds >= data_inicio && ds <= data_fim;
  };

  const contas = await store.filter('ContaFinanceira', { obra_id }, '-data_vencimento', 100000).catch(() => []);
  const receber = contas.filter((c) => c.tipo === 'receber');
  const pagar = contas.filter((c) => c.tipo === 'pagar');

  const dataLiq = (c) => c.data_recebimento || c.data_pagamento || c.updated_date;

  // Receita realizada (recebida) / prevista (pendente)
  const receitaRealizada = inc(tipo, 'REALIZADO')
    ? r2(receber.filter((c) => (c.status === 'recebido' || c.status === 'pago') && dentro(dataLiq(c))).reduce((s, c) => s + num(c.valor), 0))
    : 0;
  const receitaPrevista = inc(tipo, 'PREVISTO')
    ? r2(receber.filter((c) => c.status === 'pendente' && dentro(c.data_vencimento)).reduce((s, c) => s + num(c.valor), 0))
    : 0;

  // Despesa realizada (paga) / prevista (pendente)
  const despesaRealizada = inc(tipo, 'REALIZADO')
    ? r2(pagar.filter((c) => c.status === 'pago' && dentro(c.data_pagamento || c.updated_date)).reduce((s, c) => s + num(c.valor), 0))
    : 0;
  const despesaPrevista = inc(tipo, 'PREVISTO')
    ? r2(pagar.filter((c) => c.status === 'pendente' && dentro(c.data_vencimento)).reduce((s, c) => s + num(c.valor), 0))
    : 0;

  // Breakdown de despesas (dentro do período por qualquer data relevante)
  const despesasPeriodo = pagar.filter((c) => dentro(c.data_pagamento || c.data_vencimento || c.updated_date));
  const despesaPorCategoria = {};
  const fornMap = {};
  const ccMap = {};
  for (const d of despesasPeriodo) {
    const cat = d.categoria || 'Outra';
    despesaPorCategoria[cat] = r2((despesaPorCategoria[cat] || 0) + num(d.valor));
    const forn = d.fornecedor_cliente || d.fornecedor_nome;
    if (forn) fornMap[forn] = { fornecedor_nome: forn, valor: r2((fornMap[forn]?.valor || 0) + num(d.valor)) };
    const cc = d.centro_custo_nome || d.centro_custo_id;
    if (cc) ccMap[cc] = { centro_custo_nome: cc, valor: r2((ccMap[cc]?.valor || 0) + num(d.valor)) };
  }
  const topFornecedores = Object.values(fornMap).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const topCentroCusto = Object.values(ccMap).sort((a, b) => b.valor - a.valor).slice(0, 5);

  // Caixa diário (entradas = receber, saídas = pagar) no período
  const caixa = {};
  const add = (data, campo, valor) => {
    const dia = String(data).slice(0, 10);
    if (!caixa[dia]) caixa[dia] = { data: dia, entrada: 0, saida: 0 };
    caixa[dia][campo] = r2(caixa[dia][campo] + num(valor));
  };
  for (const c of receber) { const d = dataLiq(c) || c.data_vencimento; if (dentro(d)) add(d, 'entrada', c.valor); }
  for (const c of pagar) { const d = c.data_pagamento || c.data_vencimento || c.updated_date; if (dentro(d)) add(d, 'saida', c.valor); }
  const caixaDiario = Object.values(caixa).sort((a, b) => a.data.localeCompare(b.data));

  const receitaTotal = r2(receitaRealizada + receitaPrevista);
  const despesaTotal = r2(despesaRealizada + despesaPrevista);
  const saldoRealizado = r2(receitaRealizada - despesaRealizada);
  const saldoPrevisto = r2(receitaPrevista - despesaPrevista);
  const margemRealizada = receitaRealizada > 0 ? (saldoRealizado / receitaRealizada) * 100 : 0;

  let margemStatus = 'normal';
  if (margemRealizada < 5) margemStatus = 'critica';
  else if (margemRealizada < 10) margemStatus = 'alerta';
  else if (margemRealizada >= 20) margemStatus = 'excelente';

  return {
    success: true,
    obra_id, data_inicio, data_fim,
    receita_realizada: receitaRealizada,
    receita_prevista: receitaPrevista,
    receita_total: receitaTotal,
    despesa_realizada: despesaRealizada,
    despesa_prevista: despesaPrevista,
    despesa_total: despesaTotal,
    saldo_realizado: saldoRealizado,
    saldo_previsto: saldoPrevisto,
    saldo_total: r2(saldoRealizado + saldoPrevisto),
    margem_realizada: margemRealizada.toFixed(2),
    margem_status: margemStatus,
    despesa_por_categoria: despesaPorCategoria,
    top_fornecedores: topFornecedores,
    top_centros_custo: topCentroCusto,
    caixa_diario: caixaDiario,
  };
}
