/**
 * Perfis de acesso — utilitário de super admin.
 *
 * Observação: o antigo `DEFAULT_PERMISSIONS_MAP` (mapa de permissões por perfil
 * legado, com chaves em PascalCase) foi removido por estar MORTO — o RBACContext
 * importava `getDefaultPermissions`/`isTiTarget` mas nunca os usava. A resolução de
 * permissão hoje é:
 *   - super admin (admin/programador/owner) → acesso total;
 *   - demais → fail-closed no RBACContext + visibilidade de menu por módulo
 *     (rbacRoleDefaults.jsx).
 * A matriz canônica de permissões por perfil (chaves OBRAS_VIEW, etc.) vive em
 * roles.js > ROLE_PERMISSIONS, pronta para quando o RBAC for portado ao backend.
 */

export function isSuperAdminProfile(perfilAcesso) {
  const normalized = String(perfilAcesso || '').toLowerCase();
  return ['admin', 'programador', 'owner', 'superadmin'].includes(normalized);
}
