import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Exclui um Veiculo e, se houver, o Ativo (patrimônio) vinculado a ele.
export default async function excluirVeiculoComAtivo({ body, user }) {
  requirePermission(user, 'LOGISTICA_VIEW');
  const { veiculo_id } = body || {};
  if (!veiculo_id) throw new Error('veiculo_id é obrigatório');

  const veiculo = (await store.filter('Veiculo', { id: veiculo_id }))[0];
  if (!veiculo) return { success: true }; // já não existe

  if (veiculo.ativo_id) await store.delete('Ativo', veiculo.ativo_id).catch(() => {});
  await store.delete('Veiculo', veiculo_id);
  return { success: true };
}
