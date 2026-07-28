/**
 * Função pura para checar se user é superadmin
 * Reutilizável em backend e frontend
 */
export function isSuperAdmin(user) {
  if (!user) return false;
  
  const superAdminRoles = ['programador', 'owner', 'superadmin'];
  const roleId = user.perfil_acesso || user.perfil_sistema || user.role;
  
  return superAdminRoles.includes(roleId) || user.isOwner === true;
}

export function isSuperAdminSync(roleId, isOwner) {
  const superAdminRoles = ['programador', 'owner', 'superadmin'];
  return superAdminRoles.includes(roleId) || isOwner === true;
}