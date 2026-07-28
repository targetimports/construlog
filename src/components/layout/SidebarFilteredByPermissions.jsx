/**
 * SIDEBAR COM FILTRAGEM DE PERMISSÕES V2
 * 
 * Filtra menuItems baseado em effectivePermissionsV2
 * Esconde itens sem permissão
 */

import { useRBAC } from '../shared/RBACContext';
import { menuItems } from './navigation';

// A seção TI (diagnóstico/ops/dev) é EXCLUSIVA do perfil de TI (programador).
// Nem o admin a vê — só o TI enxerga tudo, inclusive TI.
// Mesma precedência que o RBAC usa em todo o app: perfil_acesso primeiro, role por último.
const ehPerfilTI = (user) =>
  String(user?.perfil_acesso || user?.perfil_sistema || user?.role || '').toLowerCase().trim() === 'programador';

const semTI = (itens, user) => (ehPerfilTI(user) ? itens : itens.filter((i) => i.id !== 'ti'));

export function useFilteredMenuItems() {
  const { user, effectivePermissionsV2, isSuperAdmin, rbacReady } = useRBAC();

  if (!rbacReady) return [];
  if (isSuperAdmin) return semTI(menuItems, user); // Acesso total (menos TI, salvo perfil TI)

  // Filtrar itens baseado em requiredPermissionKey
  return semTI(menuItems, user)
    .filter(item => {
      if (!item.requiredPermissionKey) return true; // Público
      return effectivePermissionsV2[item.requiredPermissionKey] === true;
    })
    .map(item => {
      // Filtrar grupos também
      if (item.groups) {
        const filteredGroups = item.groups
          .map(group => ({
            ...group,
            items: group.items.filter(subItem => {
              if (!subItem.requiredPermissionKey) return true;
              return effectivePermissionsV2[subItem.requiredPermissionKey] === true;
            })
          }))
          .filter(group => group.items.length > 0); // Remove grupos vazios

        return {
          ...item,
          groups: filteredGroups.length > 0 ? filteredGroups : undefined
        };
      }

      return item;
    })
    .filter(item => {
      // Remove itens sem grupos (grupos vazios) e sem página directa
      if (item.groups && item.groups.length === 0) return false;
      return true;
    });
}

export default function SidebarFilteredByPermissions({ children }) {
  const filteredItems = useFilteredMenuItems();

  // Passar items filtrados para o componente filho
  return <>{children({ menuItems: filteredItems })}</>;
}