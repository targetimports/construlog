/**
 * RBAC Middleware para admin_empresa
 * Validação de permissões com bypass controlado
 */

/**
 * Verifica se o usuário é admin_empresa
 */
export function isCompanyAdminBackend(user) {
  if (!user) return false;
  return user?.role === "admin_empresa" || 
         user?.perfil_acesso === "admin_empresa" ||
         user?.perfil_sistema === "admin_empresa";
}

/**
 * Verifica se a permissão/rota é TI
 */
export function isTiResourceBackend(permissionKey, resourcePath) {
  const perm = String(permissionKey || "").toLowerCase();
  const path = String(resourcePath || "").toLowerCase();

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
    "importacao_dados",
  ];

  if (tiKeywords.some((keyword) => perm.includes(keyword))) {
    return true;
  }

  if (tiKeywords.some((keyword) => path.includes(keyword))) {
    return true;
  }

  return false;
}

/**
 * Autoriza requisição com bypass para admin_empresa
 * Retorna { authorized: boolean, message?: string }
 */
export function authorizeWithAdminEmpresaBypass(user, permissionKey, resourcePath) {
  if (!user) {
    return { authorized: false, message: "Usuário não autenticado" };
  }

  // Se é admin_empresa
  if (isCompanyAdminBackend(user)) {
    // Bloquear TI
    if (isTiResourceBackend(permissionKey, resourcePath)) {
      console.warn(
        `[RBAC] admin_empresa bloqueado em recurso TI:`,
        permissionKey,
        resourcePath
      );
      return {
        authorized: false,
        message: "Acesso ao módulo TI restrito para admin_empresa",
        statusCode: 403,
      };
    }

    // Permitir tudo mais
    return { authorized: true, isBypass: true };
  }

  // Para outros roles, retornar null (deixar para validação padrão)
  return { authorized: null, message: "Aplicar RBAC padrão" };
}

/**
 * Middleware helper para funções
 * Uso:
 * const auth = await authorizeFunction(req, "permission_key", "resource_path");
 * if (!auth.authorized) return Response.json({ error: auth.message }, { status: auth.statusCode || 403 });
 */
export async function authorizeFunction(req, permissionKey, resourcePath) {
  try {
    const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.6');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    return authorizeWithAdminEmpresaBypass(user, permissionKey, resourcePath);
  } catch (error) {
    console.error("[RBAC] Erro ao autorizar:", error);
    return {
      authorized: false,
      message: "Erro ao validar permissões",
      statusCode: 500,
    };
  }
}