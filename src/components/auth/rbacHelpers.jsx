/**
 * RBAC Helpers para admin_empresa
 * Funções de segurança e bypass controlado
 */

/**
 * Verifica se o usuário é "admin_empresa"
 */
export function isCompanyAdmin(user) {
  if (!user) return false;
  const roleKey = user?.perfil_acesso || user?.perfil_sistema || user?.role;
  return roleKey === "admin_empresa";
}

/**
 * Verifica se a rota/permissão é do módulo TI
 */
export function isTiRoute(routePath, permissionKey) {
  if (!routePath && !permissionKey) return false;

  const path = String(routePath || "").toLowerCase();
  const permKey = String(permissionKey || "").toLowerCase();

  // Rotas TI
  if (
    path.startsWith("/ti") ||
    path.startsWith("/ops") ||
    path.includes("/ti/") ||
    path.includes("/admin/ti")
  ) {
    return true;
  }

  // Permission Keys TI
  const tiKeywords = [
    "ti",
    "ops",
    "rollbacks",
    "certificacao",
    "runbook",
    "snapshots",
    "saude",
    "auditoria",
    "producao",
    "console",
  ];

  if (tiKeywords.some((keyword) => permKey.includes(keyword))) {
    return true;
  }

  // Nomes de páginas TI
  const tiPages = [
    "opsconsole",
    "opscertificacao",
    "rollbacks",
    "opsmudancas",
    "opsrunbook",
    "producao",
    "snapshots",
    "saudesistema",
    "auditoria",
    "importacaodados",
    "buscaglobal",
    "timelineobra",
    "saneamentodados",
    "documentacao",
  ];

  if (tiPages.some((page) => path.includes(page.toLowerCase()))) {
    return true;
  }

  return false;
}

/**
 * Verifica se o usuário tem permissão (com bypass para admin_empresa)
 * Retorna { allowed: boolean, reason?: string }
 */
export function checkPermissionWithBypass(user, routePath, permissionKey) {
  if (!user) {
    return { allowed: false, reason: "Usuário não autenticado" };
  }

  // Se é admin_empresa
  if (isCompanyAdmin(user)) {
    // Bloquear TI
    if (isTiRoute(routePath, permissionKey)) {
      return {
        allowed: false,
        reason: "Acesso ao módulo TI restrito para admin_empresa",
        isBlockedTi: true,
      };
    }
    // Permitir tudo mais
    return { allowed: true, reason: "admin_empresa bypass", isBypass: true };
  }

  // Para outros roles, seguir RBAC normal (será feito pela chamada original)
  return { allowed: null, reason: "Aplicar RBAC padrão" };
}

/**
 * Log seguro para RBAC (sem spam)
 */
export function logRbacEvent(event, user, routePath, permissionKey) {
  if (!user) return;

  const roleKey = user?.perfil_acesso || user?.perfil_sistema || user?.role;

  switch (event) {
    case "BLOCKED_TI":
      console.warn(
        `[RBAC] ${roleKey} bloqueado em TI route:`,
        routePath,
        permissionKey
      );
      break;
    case "BYPASS_ALLOWED":
      // Não logar (evitar ruído)
      break;
    case "RBAC_DENIED":
      console.warn(
        `[RBAC] ${roleKey} sem permissão:`,
        permissionKey,
        routePath
      );
      break;
    default:
      break;
  }
}