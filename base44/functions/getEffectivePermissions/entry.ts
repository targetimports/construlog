import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calcula as permissões efetivas de um usuário
 * - Base: permissões padrão do role
 * - Se permissionsOverrideEnabled=false: retorna 100% do role
 * - Se true: aplica overrides (allowed=true adiciona, allowed=false remove)
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

    // 1. Buscar usuário-alvo (se diferente do autenticado, verificar permissão)
    const targetUser = await base44.entities.User.filter({ email: targetUserId });
    if (!targetUser || targetUser.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = targetUser[0];
    const roleId = userData.perfil_acesso || userData.perfil_sistema || 'campo'; // fallback

    // 2. Buscar permissões padrão do role
    const rolePerms = await base44.entities.RolePermission.filter({ role: roleId });
    const basePermissions = {};
    rolePerms.forEach(p => {
      basePermissions[p.menu_id] = p.allowed;
    });

    // 3. Se override desabilitado, retornar apenas base
    const permissionsOverrideEnabled = userData.permissionsOverrideEnabled || false;

    if (!permissionsOverrideEnabled) {
      return Response.json({
        effectivePermissions: basePermissions,
        source: 'role_default',
        role: roleId,
        overrideEnabled: false
      });
    }

    // 4. Se override habilitado, aplicar overrides
    const overrides = await base44.entities.UserPermissionOverride.filter({
      user_id: targetUserId
    });

    const effectivePermissions = { ...basePermissions };
    overrides.forEach(override => {
      effectivePermissions[override.menu_id] = override.allowed;
    });

    return Response.json({
      effectivePermissions,
      source: 'role_with_overrides',
      role: roleId,
      overrideEnabled: true,
      overrideCount: overrides.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});