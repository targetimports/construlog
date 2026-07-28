import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Marca/desmarca uma conta financeira como conciliada, opcionalmente vinculando
// a uma movimentação de tesouraria.
export default async function conciliarContaFinanceira({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');

  const { conta_id, movimentacao_id, desfazer } = body || {};
  if (!conta_id) return { ok: false, error: 'conta_id é obrigatório' };

  const c = (await store.filter('ContaFinanceira', { id: conta_id }))[0];
  if (!c) return { ok: false, error: 'Conta não encontrada' };

  if (desfazer) {
    await store.update('ContaFinanceira', conta_id, {
      conciliado: false, conciliacao_movimentacao_id: null, data_conciliacao: null,
    });
    if (c.conciliacao_movimentacao_id) {
      await store.update('MovimentacaoTesouraria', c.conciliacao_movimentacao_id, { conciliado: false }).catch(() => {});
    }
    return { ok: true, conciliado: false };
  }

  await store.update('ContaFinanceira', conta_id, {
    conciliado: true,
    conciliacao_movimentacao_id: movimentacao_id || null,
    data_conciliacao: new Date().toISOString().slice(0, 10),
  });
  if (movimentacao_id) {
    await store.update('MovimentacaoTesouraria', movimentacao_id, { conciliado: true }).catch(() => {});
  }
  return { ok: true, conciliado: true };
}
