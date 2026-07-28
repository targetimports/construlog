import rolePermissions from './rolePermissions.json';

/**
 * Valida se um usuário tem permissão para uma ação
 * @param {string} userRole - Perfil do usuário (e.g., 'programador', 'geral', 'campo')
 * @param {string} permission - Permissão requerida (e.g., 'OBRA_CREATE', 'FIN_VIEW')
 * @returns {boolean} true se tem permissão, false caso contrário
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false;
  
  const role = rolePermissions.roles[userRole];
  if (!role) return false;
  
  return role.permissoes.includes(permission);
}

/**
 * Valida se um usuário pode acessar um menu
 * @param {string} userRole - Perfil do usuário
 * @param {string} menuId - ID do menu (e.g., 'financeiro', 'ti', 'campo')
 * @returns {boolean} true se pode acessar, false caso contrário
 */
export function canAccessMenu(userRole, menuId) {
  if (!userRole || !menuId) return false;
  
  const role = rolePermissions.roles[userRole];
  if (!role) return false;
  
  return role.menus.includes(menuId);
}

/**
 * Retorna todas as permissões de um perfil
 * @param {string} userRole - Perfil do usuário
 * @returns {array} Array de permissões
 */
export function getPermissions(userRole) {
  const role = rolePermissions.roles[userRole];
  return role ? role.permissoes : [];
}

/**
 * Retorna todos os menus acessíveis para um perfil
 * @param {string} userRole - Perfil do usuário
 * @returns {array} Array de IDs de menus
 */
export function getAccessibleMenus(userRole) {
  const role = rolePermissions.roles[userRole];
  return role ? role.menus : [];
}

/**
 * Hook React para validar permissão
 */
export function useHasPermission(userRole, permission) {
  return hasPermission(userRole, permission);
}

/**
 * Hook React para validar acesso a menu
 */
export function useCanAccessMenu(userRole, menuId) {
  return canAccessMenu(userRole, menuId);
}

/**
 * Guard de componente - bloqueia render se sem permissão
 */
export function withPermissionCheck(permission) {
  return (WrappedComponent) => {
    return function PermissionCheckedComponent({ user, ...props }) {
      if (!user || !hasPermission(user.perfil_acesso, permission)) {
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600">Acesso Negado</h2>
            <p className="text-gray-600 mt-2">Você não tem permissão para acessar este recurso.</p>
          </div>
        );
      }
      return <WrappedComponent user={user} {...props} />;
    };
  };
}

export default {
  hasPermission,
  canAccessMenu,
  getPermissions,
  getAccessibleMenus,
  useHasPermission,
  useCanAccessMenu,
  withPermissionCheck
};