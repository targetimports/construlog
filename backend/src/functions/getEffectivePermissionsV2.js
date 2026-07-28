import { effectivePermissions } from '../rbac.js';
import { store } from '../entityStore.js';

// Retorna as permissões efetivas do usuário autenticado (V2).
// A autorização é derivada do role do JWT — não confia em input do cliente.
// Sobre a base da role, aplica os ajustes finos por usuário (UserPermissionOverride).
export default async function getEffectivePermissionsV2({ user }) {
  let overrides = [];
  try {
    overrides = await store.filter('UserPermissionOverride', { user_id: user?.email }, null, 200);
  } catch {
    overrides = []; // fail-open só para o override; a base da role continua valendo
  }
  return effectivePermissions(user, overrides);
}
