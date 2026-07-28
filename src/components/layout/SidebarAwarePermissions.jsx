import React, { useMemo } from 'react';

/**
 * HOC para filtrar menu items baseado em effectivePermissions
 * Remove itens sem permissão e subgrupos vazios
 */
export function filterMenuByPermissions(menuItems, effectivePermissions) {
  return menuItems
    .map(menu => {
      // Verificar se item raiz tem permissão
      const menuAllowed = effectivePermissions[menu.id] !== false;

      if (!menuAllowed) {
        return null; // Ocultar item completo
      }

      // Se tem subgrupos, filtrar recursivamente
      if (menu.groups && Array.isArray(menu.groups)) {
        const filteredGroups = menu.groups
          .map(group => {
            const filteredItems = group.items?.filter(item => {
              return effectivePermissions[item.id] !== false;
            }) || [];

            // Se grupo ficou vazio, não incluir
            if (filteredItems.length === 0) {
              return null;
            }

            return {
              ...group,
              items: filteredItems
            };
          })
          .filter(Boolean); // Remove nulls

        // Se não tem subgrupos permitidos, ocultar o pai
        if (filteredGroups.length === 0) {
          return null;
        }

        return {
          ...menu,
          groups: filteredGroups
        };
      }

      return menu;
    })
    .filter(Boolean); // Remove nulls do nível superior
}

/**
 * Hook para usar no SidebarCompact
 */
export function useFilteredMenu(menuItems, effectivePermissions) {
  return useMemo(() => {
    if (!effectivePermissions) return menuItems;
    return filterMenuByPermissions(menuItems, effectivePermissions);
  }, [menuItems, effectivePermissions]);
}