import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Remove um registro de uso de equipamento e a conta financeira vinculada.
export default async function removerUsoEquipamento({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const registro_id = body?.registro_id;
  if (!registro_id) throw new Error('ID do registro obrigatório');

  const reg = (await store.filter('RegistroUsoEquipamento', { id: registro_id }))[0];
  if (!reg) throw new Error('Registro não encontrado');

  // Remove o custo vinculado (nova ContaFinanceira ou o legado LancamentoFinanceiro).
  if (reg.conta_financeira_id) await store.delete('ContaFinanceira', reg.conta_financeira_id).catch(() => {});
  if (reg.lancamento_financeiro_id) await store.delete('LancamentoFinanceiro', reg.lancamento_financeiro_id).catch(() => {});

  await store.delete('RegistroUsoEquipamento', registro_id);
  return { success: true };
}
