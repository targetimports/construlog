import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Debug: Verifica as permissões de um usuário de Logística
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await req.json();
    const targetUserId = userId || user.email;

    // 1. Obter usuário-alvo
    const targetUsers = await base44.entities.User.filter({ email: targetUserId });
    if (!targetUsers || targetUsers.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = targetUsers[0];
    const role = userData.perfil_acesso || userData.perfil_sistema || 'campo';

    // 2. Buscar RolePermissions para este role
    const rolePerms = await base44.entities.RolePermission.filter({ role });
    
    // 3. Chamar getEffectivePermissions
    let effectivePerms = {};
    try {
      const response = await base44.functions.invoke('getEffectivePermissions', {
        userId: targetUserId
      });
      effectivePerms = response.data.effectivePermissions || {};
    } catch (err) {
      console.error('[DEBUG] getEffectivePermissions error:', err);
    }

    return Response.json({
      success: true,
      debug: {
        user_email: userData.email,
        role,
        status_acesso: userData.status_acesso,
        permissionsOverrideEnabled: userData.permissionsOverrideEnabled || false,
        rolePermissionsCount: rolePerms.length,
        rolePermissionsIds: rolePerms.map(p => p.menu_id),
        effectivePermissionsCount: Object.keys(effectivePerms).length,
        effectivePermissionsKeys: Object.keys(effectivePerms),
        logisticaPermissionsAllowed: Object.entries(effectivePerms)
          .filter(([k]) => k.includes('logistica'))
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
      }
    });
  } catch (error) {
    console.error('[DEBUG ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});