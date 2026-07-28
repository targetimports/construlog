import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Chamado no login: Garante que role do usuário tem permissões mínimas
 * - Fetch user
 * - Trigger repair automático
 * - Retorna user com permissões validadas
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleId = user.perfil_acesso || user.perfil_sistema || 'campo';

    // Trigger repair automático
    try {
      const repairRes = await base44.functions.invoke('rolePermissionsRepair', {
        roleId
      });
      console.log('[LOGIN REPAIR]', repairRes.data);
    } catch (err) {
      console.warn('[LOGIN REPAIR ERROR]', err);
      // Não falha o login se repair falhar
    }

    // Retornar usuário com confirmação
    return Response.json({
      success: true,
      user,
      roleId,
      message: 'Login com repair de permissões'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});