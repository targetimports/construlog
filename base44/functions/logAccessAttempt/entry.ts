import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Log de tentativa de acesso (para auditoria + debug)
 * Registra: userId, role, routePath, requiredPermission, allowed, timestamp
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      routePath,
      requiredPermission,
      allowed,
      effectivePermissionsCount
    } = await req.json();

    const logEntry = {
      user_email: user.email,
      user_role: user.perfil_acesso || user.perfil_sistema || 'campo',
      route_path: routePath,
      required_permission: requiredPermission,
      allowed,
      effective_perms_count: effectivePermissionsCount || 0,
      timestamp: new Date().toISOString(),
      user_agent: req.headers.get('user-agent')
    };

    // Criar LogAccessAttempt se houver entidade, senão apenas logar
    try {
      await base44.entities.LogAccessAttempt.create(logEntry);
    } catch (err) {
      // Entidade pode não existir ainda, apenas logar no console
      console.log('[ACCESS LOG]', logEntry);
    }

    return Response.json({
      success: true,
      logged: true
    });
  } catch (error) {
    console.error('[LOG ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});