/**
 * getAccessContext() - Função centralizada para obter contexto de acesso
 * 
 * Retorna:
 * {
 *   userId, email, roleId, isSuperAdmin,
 *   allowAll, denyModules[], allowModules[],
 *   allowRoutes[], effectivePermissions{},
 *   fallback: boolean, source: 'server' | 'defaults'
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Defaults inline para fallback rápido
const ROLE_DEFAULTS = {
  programador: {
    isSuperAdmin: true,
    allowAll: true,
    denyModules: []
  },
  admin_empresa: {
    isSuperAdmin: false,
    allowAll: true,
    denyModules: ['TI', 'Administração']
  },
  diretoria: {
    isSuperAdmin: false,
    allowModules: ['DashboardExecutivo', 'Financeiro', 'Obras', 'Suprimentos', 'Estoques', 'Logística', 'RH', 'Relatórios'],
    denyModules: ['TI', 'Administração']
  },
  engenharia: {
    isSuperAdmin: false,
    allowModules: ['Obras', 'Agenda', 'Relatórios', 'Cadastros', 'Suprimentos'],
    denyModules: ['Financeiro', 'TI', 'RH', 'Administração']
  },
  compras: {
    isSuperAdmin: false,
    allowModules: ['Suprimentos', 'Fornecedores', 'Cadastros', 'Agenda'],
    denyModules: ['Financeiro', 'TI', 'RH', 'Administração']
  },
  almoxarifado: {
    isSuperAdmin: false,
    allowModules: ['Estoque', 'Suprimentos', 'Cadastros', 'Agenda'],
    denyModules: ['Financeiro', 'TI', 'RH', 'Administração']
  },
  logistica: {
    isSuperAdmin: false,
    allowModules: ['Logística', 'Agenda', 'Equipamentos'],
    denyModules: ['Financeiro', 'TI', 'RH', 'Administração']
  },
  financeiro: {
    isSuperAdmin: false,
    allowModules: ['Financeiro', 'Relatórios', 'Obras'],
    denyModules: ['TI', 'Administração']
  },
  rh: {
    isSuperAdmin: false,
    allowModules: ['RH', 'Agenda', 'Relatórios'],
    denyModules: ['Financeiro', 'TI', 'Administração']
  },
  campo: {
    isSuperAdmin: false,
    allowModules: ['Agenda', 'DiarioCampo', 'Consultas'],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH']
  },
  geral: {
    isSuperAdmin: false,
    allowModules: ['Dashboard', 'Agenda', 'Consultas'],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH']
  }
};

Deno.serve(async (req) => {
  try {
    // Auth
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.email;
    const roleId = user.perfil_acesso || user.perfil_sistema || user.role || 'geral';

    console.log(`[RBAC] getAccessContext: user=${userId} roleId=${roleId}`);

    // Tentar buscar permissões customizadas do banco
    let customPermissions = null;
    let source = 'defaults';

    try {
      const userOverride = await base44.asServiceRole.entities.UserPermissionOverride.filter({
        user_id: userId
      });

      if (userOverride && userOverride.length > 0) {
        customPermissions = userOverride;
        source = 'server';
        console.log(`[RBAC] Permissões customizadas encontradas para ${userId}`);
      }
    } catch (err) {
      console.warn(`[RBAC] Falha ao buscar overrides: ${err.message}, usando defaults`);
    }

    // Obter defaults do roleId
    const roleDefaults = ROLE_DEFAULTS[String(roleId).toLowerCase()] || ROLE_DEFAULTS.geral;

    // Calcular permissões efetivas
    let effectivePermissions = {};
    const isSuperAdmin = roleDefaults.isSuperAdmin === true;

    if (isSuperAdmin) {
      // Super admin: acesso total, nenhuma restrição
      effectivePermissions = { SUPER_ADMIN: true };
    } else if (roleDefaults.allowAll) {
      // allowAll=true: permitir tudo exceto denyModules
      effectivePermissions = {
        ALLOW_ALL: true,
        DENY_MODULES: roleDefaults.denyModules || []
      };
    } else if (roleDefaults.allowModules) {
      // Apenas módulos específicos
      (roleDefaults.allowModules || []).forEach(mod => {
        effectivePermissions[`MODULE_${mod.toUpperCase()}`] = true;
      });
    }

    // Se há overrides customizados, aplicá-los
    if (customPermissions && Array.isArray(customPermissions)) {
      customPermissions.forEach(override => {
        const key = String(override.permission_key || '').toUpperCase();
        if (key) {
          effectivePermissions[key] = override.allowed === true;
        }
      });
    }

    const response = {
      userId,
      email: user.email,
      roleId,
      isSuperAdmin,
      allowAll: roleDefaults.allowAll === true,
      denyModules: roleDefaults.denyModules || [],
      allowModules: roleDefaults.allowModules || [],
      effectivePermissions,
      source,
      fallback: source === 'defaults',
      timestamp: new Date().toISOString()
    };

    console.log(`[RBAC] getAccessContext OK: ${userId} (${source}, isSuperAdmin=${isSuperAdmin})`);

    return Response.json(response, { status: 200 });
  } catch (error) {
    console.error('[RBAC] getAccessContext ERROR:', error.message);

    // Nunca retornar erro vazio - sempre retornar contexto fallback básico
    return Response.json(
      {
        error: 'Failed to get access context',
        fallback: true,
        roleId: 'geral',
        isSuperAdmin: false,
        allowAll: false,
        allowModules: ['Dashboard', 'Agenda', 'Consultas'],
        denyModules: ['Financeiro', 'TI', 'Administração', 'RH'],
        source: 'error_fallback'
      },
      { status: 200 } // Retornar 200 mesmo em erro para não quebrar frontend
    );
  }
});