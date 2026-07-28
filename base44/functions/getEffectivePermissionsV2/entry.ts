import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { safeJson } from './_utils/safeJson.js';
// touch: redeploy 2026-02-26 18:50:00

// Mapeamento legado -> novo (mantido para compatibilidade com o frontend atual)
const legacyToNewKeyMap = {
  Dashboard: ['DASHBOARD_VIEW'],
  Calendario: ['CALENDARIO_VIEW'],
  Obras: ['OBRAS_VIEW'],
  GestaoObras: ['OBRAS_VIEW', 'OBRAS_EDIT'],
  DiarioObra: ['OBRAS_VIEW', 'DIARIO_CREATE'],
  Medicoes: ['MEDICOES_VIEW'],
  MapaMedicoes: ['MEDICOES_VIEW'],
  Engenharia: ['ENGENHARIA_VIEW'],
  Suprimentos: ['COMPRAS_VIEW'],
  SolicitarCompra: ['COMPRAS_CREATE'],
  Requisicoes: ['COMPRAS_VIEW'],
  AprovarSolicitacoes: ['COMPRAS_APPROVE'],
  Cotacoes: ['COMPRAS_VIEW'],
  OrdensCompra: ['COMPRAS_VIEW'],
  Contratos: ['CONTRATOS_VIEW'],
  Estoques: ['ESTOQUE_VIEW'],
  EstoquesVisaoGeral: ['ESTOQUE_VIEW'],
  EstoquesSaldo: ['ESTOQUE_VIEW'],
  EstoquesDepositos: ['ESTOQUE_VIEW'],
  Logistica: ['LOGISTICA_VIEW'],
  LogisticaFrota: ['LOGISTICA_VIEW'],
  LogisticaMotoristas: ['LOGISTICA_VIEW'],
  LogisticaViagens: ['LOGISTICA_VIEW'],
  LogisticaMinhasRotas: ['LOGISTICA_VIEW'],
  LogisticaSolicitarTransporte: ['LOGISTICA_CREATE'],
  Equipamentos: ['EQUIPAMENTOS_VIEW'],
  Financeiro: ['FINANCEIRO_VIEW'],
  RH: ['RH_VIEW'],
  Relatorios: ['RELATORIOS_VIEW'],
  Cadastros: ['CADASTROS_VIEW'],
  Administracao: ['ADMIN_CONFIG'],
};

function normalize(key) {
  return String(key || '').trim();
}

function buildNewPermissionsFromLegacy(legacyPermissions) {
  const newPerms = {};
  Object.entries(legacyPermissions || {}).forEach(([legacyKey, allowed]) => {
    if (!allowed) return;
    const newKeys = legacyToNewKeyMap[legacyKey] || [];
    newKeys.forEach((k) => { newPerms[k] = true; });
  });
  // Liberado para qualquer usuário autenticado
  newPerms['PROFILE_EDIT'] = true;
  return newPerms;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await safeJson(req, {});

    // Apenas admin/programador pode consultar outro usuário
    const isAdminAuth = (user.role === 'admin' || user.role === 'programador');
    if (userId && userId !== user.email && !isAdminAuth) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const targetUserId = userId || user.email;

    // Buscar usuário alvo (service role para evitar 403 em non-admin users)
    const targetUsers = await base44.asServiceRole.entities.User.filter({ email: targetUserId }).catch(() => []);
    if (!targetUsers || targetUsers.length === 0) {
      return Response.json({
        success: false,
        effectivePermissions: {},
        effectivePermissionsV2: { PROFILE_EDIT: true },
        source: 'user_not_found',
        requestId
      }, { status: 404 });
    }

    const userData = targetUsers[0];
    const roleId = userData.perfil_acesso || userData.perfil_sistema || userData.role || 'campo';
    const cargo = userData.cargo || '';
    const overrideEnabled = userData.permissionsOverrideEnabled === true;

    const isCompanyAdmin = (roleId === 'admin' || roleId === 'admin_empresa' || cargo === 'admin_empresa');
    const isSuperAdminRole = (roleId === 'programador' || userData.isOwner === true);

    // Base por role
    let rolePerms = await base44.asServiceRole.entities.RolePermission.filter({ role: roleId }).catch(() => []);
    const basePermissions = {};
    (rolePerms || []).forEach((p) => { basePermissions[normalize(p.permission_key)] = p.allowed !== false; });

    // Se vazio, aplicar fallback por papel
    if (Object.keys(basePermissions).length === 0) {
      if (isSuperAdminRole) {
        const v2 = { ADMIN_CONFIG: true, PROFILE_EDIT: true, DASHBOARD_VIEW: true };
        return Response.json({
          success: true,
          effectivePermissions: {},
          effectivePermissionsV2: v2,
          source: 'fallback_super_admin',
          role: roleId,
          isCompanyAdmin,
          isSuperAdmin: isSuperAdminRole
        });
      }
      if (isCompanyAdmin) {
        // Admin empresa: permissão TOTAL (exceto ADMIN_CONFIG que é só super admin)
        const v2 = {
          PROFILE_EDIT: true, DASHBOARD_VIEW: true, CALENDARIO_VIEW: true,
          OBRAS_VIEW: true, OBRAS_EDIT: true, DIARIO_CREATE: true,
          MEDICOES_VIEW: true, ENGENHARIA_VIEW: true,
          COMPRAS_VIEW: true, COMPRAS_CREATE: true, COMPRAS_APPROVE: true,
          CONTRATOS_VIEW: true, ESTOQUE_VIEW: true,
          LOGISTICA_VIEW: true, LOGISTICA_CREATE: true,
          EQUIPAMENTOS_VIEW: true,
          FINANCEIRO_VIEW: true, RH_VIEW: true,
          RELATORIOS_VIEW: true, CADASTROS_VIEW: true
        };
        return Response.json({
          success: true,
          effectivePermissions: {},
          effectivePermissionsV2: v2,
          source: 'fallback_admin_empresa_full',
          role: roleId,
          isCompanyAdmin: true,
          isSuperAdmin: false
        });
      }
    }

    // Aplicar overrides por usuário
    let effective = { ...basePermissions };
    if (overrideEnabled) {
      const overrides = await base44.asServiceRole.entities.UserPermissionOverride.filter({ user_id: targetUserId }).catch(() => []);
      (overrides || []).forEach((ov) => {
        const k = normalize(ov.permission_key);
        if (ov.allowed === true) effective[k] = true; // ADD
        else if (ov.allowed === false) delete effective[k]; // REMOVE
      });
      if (Object.keys(effective).length === 0) {
        // Nunca retornar vazio
        effective = { ...basePermissions };
      }
    }

    let effectiveV2 = buildNewPermissionsFromLegacy(effective);

    // Admin empresa: garantir todas as permissões V2 operacionais (exceto ADMIN_CONFIG)
    if (isCompanyAdmin && !isSuperAdminRole) {
      const adminEmpresaPerms = {
        PROFILE_EDIT: true, DASHBOARD_VIEW: true, CALENDARIO_VIEW: true,
        OBRAS_VIEW: true, OBRAS_EDIT: true, DIARIO_CREATE: true,
        MEDICOES_VIEW: true, ENGENHARIA_VIEW: true,
        COMPRAS_VIEW: true, COMPRAS_CREATE: true, COMPRAS_APPROVE: true,
        CONTRATOS_VIEW: true, ESTOQUE_VIEW: true,
        LOGISTICA_VIEW: true, LOGISTICA_CREATE: true,
        EQUIPAMENTOS_VIEW: true,
        FINANCEIRO_VIEW: true, RH_VIEW: true,
        RELATORIOS_VIEW: true, CADASTROS_VIEW: true
      };
      effectiveV2 = { ...adminEmpresaPerms, ...effectiveV2 };
    }

    const result = {
      success: true,
      effectivePermissions: effective, // legado
      effectivePermissionsV2: effectiveV2, // novo
      permissionFormat: 'compat_v1_legacy_plus_v2',
      source: overrideEnabled ? 'role_plus_overrides' : 'role_only',
      role: roleId,
      isCompanyAdmin,
      isSuperAdmin: isSuperAdminRole,
      overrideEnabled,
      requestId
    };

    return Response.json(result);
  } catch (error) {
    console.error('[RBAC getEffectivePermissionsV2] error', error?.message, requestId);
    // Retornar 200 com fallback mínimo para não quebrar o boot do app
    return Response.json({
      success: false,
      effectivePermissions: {},
      effectivePermissionsV2: { PROFILE_EDIT: true, DASHBOARD_VIEW: true },
      source: 'error_safe_fallback',
      error: error?.message || String(error),
      requestId
    }, { status: 200 });
  }
});