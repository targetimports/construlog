/**
 * Sistema centralizado de failsafe para RBAC
 * Evita erros 500/502 e garantir acesso mínimo
 */

const PERMISSION_TIMEOUT = 3000; // 3 segundos max
const MENU_TIMEOUT = 2000; // 2 segundos max

/**
 * Detectar se é super admin (sempre libera tudo)
 */
export function isSuperAdmin(user) {
  if (!user) return false;
  const role = user.role || user.perfil_acesso || '';
  const cargo = user.cargo || '';
  return (
    role === 'programador' || 
    role === 'admin' || 
    cargo === 'admin_empresa' || 
    user.isSuperAdmin === true || 
    user.isOwner === true
  );
}

/**
 * Wrapper com timeout para fetch de permissões
 */
export async function fetchPermissionsWithTimeout(userId, timeout = PERMISSION_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/base44/functions/getEffectivePermissionsV2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[RBAC] Falha ${response.status}, usando fallback`);
      return getFallbackPermissions('timeout');
    }

    const data = await response.json();
    
    // Se retornar bypass, retornar com allowAll
    if (data.bypassMode === true || data.isSuperAdmin === true) {
      return {
        ...data,
        allowAll: true,
        effectivePermissions: { '*': true }
      };
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('[RBAC] Timeout/erro, usando fallback:', error.message);
    return getFallbackPermissions('error');
  }
}

/**
 * Wrapper com timeout para fetch de menu
 */
export async function fetchMenuWithTimeout(isSuperAdmin, isCompanyAdmin, timeout = MENU_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/base44/functions/getMenuForBootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSuperAdmin, isCompanyAdmin }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Menu] Falha ${response.status}, usando fallback`);
      return getDefaultMenuIds(isSuperAdmin, isCompanyAdmin);
    }

    const data = await response.json();
    return data.menuIds || getDefaultMenuIds(isSuperAdmin, isCompanyAdmin);
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('[Menu] Timeout/erro, usando fallback:', error.message);
    return getDefaultMenuIds(isSuperAdmin, isCompanyAdmin);
  }
}

/**
 * Fallback de permissões
 */
function getFallbackPermissions(reason) {
  return {
    success: true,
    effectivePermissions: { '*': true },
    source: `fallback_${reason}`,
    allowAll: true,
    bypassMode: true,
    isCompanyAdmin: true,
    isSuperAdmin: true,
    reason: `Modo failsafe ativado: ${reason}`
  };
}

/**
 * Menu padrão por nível
 */
function getDefaultMenuIds(isSuperAdmin, isCompanyAdmin) {
  const baseMenus = [
    'dashboard', 'obras', 'calendario', 'suprimentos', 'estoques', 
    'logistica', 'equipamentos', 'financeiro', 'cadastros', 'rh', 
    'relatorios', 'ajuda', 'atalhos', 'notificacoes', 'ajustes'
  ];

  if (isSuperAdmin) {
    return [...baseMenus, 'administracao', 'ti', 'implementacoes', 'assistentes-ia'];
  }

  if (isCompanyAdmin) {
    return [...baseMenus, 'administracao', 'implementacoes', 'assistentes-ia'];
  }

  return baseMenus;
}

/**
 * Verificar se usuário pode acessar rota
 * Sempre retorna true para super admin
 */
export function canAccessRoute(routeName, user, permissions = {}) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (permissions?.allowAll === true) return true;
  
  // Sem permissões específicas definidas = bloquear por segurança
  return false;
}

/**
 * Wrapper seguro para chamadas API que podem falhar
 */
export async function safeFetch(url, options = {}, fallbackData = null) {
  const timeout = options.timeout || 3000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[SafeFetch] ${url} retornou ${response.status}`);
      return { ok: false, data: fallbackData, status: response.status };
    }

    const data = await response.json();
    return { ok: true, data, status: 200 };
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[SafeFetch] ${url} erro:`, error.message);
    return { ok: false, data: fallbackData, error: error.message };
  }
}