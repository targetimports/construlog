import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { registrarSaidaCaixa, ajustarVerbaEmpresa, empresaDaConta } from './tesourariaCore.js';

// Baixa de uma conta a pagar (ContaFinanceira tipo 'pagar').
// Fase 2: além de marcar 'pago', (1) DÁ BAIXA NO CAIXA (ContaTesouraria escolhida +
// MovimentacaoTesouraria de saída — conserta "pagar não baixa o caixa") e (2) decrementa
// a VERBA da empresa dona (o gasto consome a verba alocada). conta_tesouraria_id é
// opcional (sem ela, só marca pago sem mexer no caixa — compat com a tela antiga).
const num = (v) => Number(v) || 0;

export default async function pagarContaPagar({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');

  const id = body?.conta_id;
  if (!id) return { success: false, error: 'conta_id é obrigatório' };

  const c = (await store.filter('ContaFinanceira', { id }))[0];
  if (!c) return { success: false, error: 'Conta não encontrada' };
  if (c.status === 'pago') return { success: false, error: 'Conta já está paga' };
  if (c.status === 'em_aprovacao') return { success: false, error: 'Conta aguardando aprovação (alçada)' };

  const valorPago = num(body?.valor_pago) || num(c.valor) || 0;
  const dataPag = body?.data_pagamento || new Date().toISOString().slice(0, 10);
  const contaTesId = body?.conta_tesouraria_id || null;

  // Isolamento: o caixa usado deve ser da MESMA empresa dona da conta (não pagar
  // conta de uma empresa com o caixa de outra). Só valida quando ambos são conhecidos.
  if (contaTesId) {
    const caixa = (await store.filter('ContaTesouraria', { id: contaTesId }))[0];
    const empresaConta = await empresaDaConta(c);
    if (caixa && empresaConta && (caixa.empresa_id || null) !== empresaConta) {
      return { success: false, error: 'O caixa escolhido é de outra empresa. Use um caixa da empresa dona da conta.' };
    }
  }

  // (1) Baixa no caixa (se a conta de pagamento foi informada).
  let movId = null;
  if (contaTesId) {
    const r = await registrarSaidaCaixa({
      conta_id: contaTesId, valor: valorPago, user,
      meta: {
        categoria: 'pagamento',
        descricao: `Pagamento: ${c.descricao || c.fornecedor_cliente || ''}`.trim(),
        obra_id: c.obra_id || null, referencia_tipo: 'conta_financeira', referencia_id: id, data: dataPag,
      },
    });
    if (r.error) return { success: false, error: r.error };
    movId = r.movimentacao_id;
  }

  await store.update('ContaFinanceira', id, {
    status: 'pago',
    data_pagamento: dataPag,
    valor_pago: valorPago,
    conta_tesouraria_id: contaTesId,
    conciliacao_movimentacao_id: movId,
    conciliado: !!movId,
    data_conciliacao: movId ? dataPag : null,
  });

  // (2) O gasto consome a verba da empresa dona (via conta ou obra).
  const empresaId = await empresaDaConta(c);
  let saldoVerba = null;
  if (empresaId) {
    const rv = await ajustarVerbaEmpresa({ empresa_id: empresaId, delta: -valorPago, user });
    saldoVerba = rv.saldo_verba;
  }

  return { success: true, movimentacao_id: movId, empresa_id: empresaId, saldo_verba: saldoVerba };
}
