import { store } from '../entityStore.js';
import { requirePermission, can } from '../rbac.js';

// Verifica a alçada de aprovação de uma conta a pagar.
//  - Quem tem FINANCEIRO_APPROVE (financeiro/admin) ou valor dentro do limite
//    -> DIRECT_ALLOWED (segue para pagamento, status pendente).
//  - Acima do limite e sem alçada -> NEEDS_APPROVAL (status em_aprovacao).
const LIMITE_ALCADA = 10000;

export default async function solicitarAprovacaoPagamento({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');

  const id = body?.conta_id;
  if (!id) return { success: false, error: 'conta_id é obrigatório' };

  const c = (await store.filter('ContaFinanceira', { id }))[0];
  if (!c) return { success: false, error: 'Conta não encontrada' };

  const valor = Number(c.valor) || 0;
  const dentroAlcada = can(user, 'FINANCEIRO_APPROVE') || valor <= LIMITE_ALCADA;

  if (dentroAlcada) {
    if (c.status !== 'pendente') await store.update('ContaFinanceira', id, { status: 'pendente' });
    return { success: true, branch: 'DIRECT_ALLOWED' };
  }

  await store.update('ContaFinanceira', id, { status: 'em_aprovacao' });
  return { success: true, branch: 'NEEDS_APPROVAL' };
}
