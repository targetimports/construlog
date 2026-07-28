import { PERMISSION_AREAS, ROLE_PERMISSIONS } from '../rbac.js';

// Catálogo para a tela de Permissões de Usuários:
//   - areas: lista de áreas ajustáveis (key, label, grupo)
//   - roleBase: para cada role, as áreas que ela já concede por padrão (a base)
// Assim o front mostra "o que vem da role" sem duplicar a lógica de RBAC.
export default async function getPermissoesCatalogo() {
  const areaKeys = new Set(PERMISSION_AREAS.map((a) => a.key));
  const roleBase = {};
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    roleBase[role] = Object.keys(perms).filter((k) => areaKeys.has(k));
  }
  return { areas: PERMISSION_AREAS, roleBase };
}
