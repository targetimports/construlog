import React, { useMemo } from 'react';

/**
 * Filtra menu items baseado em effectivePermissions
 * - Menu item tem requiredPermissionKey
 * - Mostrar SOMENTE se está em effectivePermissions[key] === true
 */
export function filterMenuByPermissions(menuItems, effectivePermissions) {
  if (!effectivePermissions) return menuItems;

  return menuItems
    .map(menu => {
      const menuAllowed = effectivePermissions[menu.id] !== false;

      if (!menuAllowed) {
        return null; // Ocultar item
      }

      // Se tem groups/subitens, filtrar recursivamente
      if (menu.groups && Array.isArray(menu.groups)) {
        const filteredGroups = menu.groups
          .map(group => {
            const filteredItems = (group.items || [])
              .filter(item => effectivePermissions[item.id] !== false);

            if (filteredItems.length === 0) {
              return null; // Grupo vazio
            }

            return { ...group, items: filteredItems };
          })
          .filter(Boolean);

        if (filteredGroups.length === 0) {
          return null; // Nenhum subitem
        }

        return { ...menu, groups: filteredGroups };
      }

      return menu;
    })
    .filter(Boolean);
}

/**
 * Hook para usar no SidebarCompact
 */
export function useFilteredMenu(menuItems, effectivePermissions) {
  return useMemo(() => {
    return filterMenuByPermissions(menuItems, effectivePermissions);
  }, [menuItems, effectivePermissions]);
}