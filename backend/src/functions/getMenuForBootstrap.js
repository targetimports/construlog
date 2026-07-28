import { menuFor } from '../rbac.js';
import { store } from '../entityStore.js';

// Retorna os ids das seções de topo do menu visíveis para o usuário
// (base da role + ajustes finos por usuário via UserPermissionOverride).
export default async function getMenuForBootstrap({ user }) {
  let overrides = [];
  try {
    overrides = await store.filter('UserPermissionOverride', { user_id: user?.email }, null, 200);
  } catch {
    overrides = [];
  }
  return { menuIds: menuFor(user, overrides) };
}
