import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sincroniza menus do sidebar com as permissões efetivas do usuário
 * Integração com obterMenusPermitidos
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

    // 1. Buscar usuário-alvo
    const targetUsers = await base44.entities.User.filter({ email: targetUserId });
    if (!targetUsers || targetUsers.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = targetUsers[0];
    const roleId = userData.perfil_acesso || userData.perfil_sistema || 'campo';

    // 2. Buscar permissões padrão do role
    const rolePerms = await base44.entities.RolePermission.filter({ role: roleId });
    const baseMenuIds = new Set(rolePerms.map(p => p.menu_id));

    // 3. Buscar overrides se habilitados
    const overrideEnabled = userData.permissionsOverrideEnabled || false;
    let effectiveMenuIds = new Set(baseMenuIds);

    if (overrideEnabled) {
      const overrides = await base44.entities.UserPermissionOverride.filter({
        user_id: targetUserId
      });

      overrides.forEach(override => {
        if (override.allowed) {
          effectiveMenuIds.add(override.menu_id);
        } else {
          effectiveMenuIds.delete(override.menu_id);
        }
      });
    }

    return Response.json({
      userId: targetUserId,
      role: roleId,
      overrideEnabled,
      effectiveMenuIds: Array.from(effectiveMenuIds),
      totalMenus: effectiveMenuIds.size
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});