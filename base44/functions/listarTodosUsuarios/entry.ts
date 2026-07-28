import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica se é admin geral ou admin de empresa
    const isAdmin = user.role === 'admin' || user.role === 'programador';
    const isCompanyAdmin = user.isCompanyAdmin || user.perfil_acesso === 'admin' || user.cargo === 'admin_empresa';

    if (!isAdmin && !isCompanyAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Admin global vê todos; admin_empresa vê apenas usuários da sua empresa
    let usuarios;
    if (isAdmin) {
      usuarios = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    } else {
      // 🔒 Filtrar por empresa para evitar cross-tenant leakage
      const empresaId = user.empresa_id || user.empresa;
      if (!empresaId) {
        return Response.json({ error: 'Forbidden: empresa_id não definido para este usuário' }, { status: 403 });
      }
      usuarios = await base44.asServiceRole.entities.User.filter({ empresa_id: empresaId }, '-created_date', 1000);
    }

    return Response.json(usuarios || []);
  } catch (error) {
    console.error('[listarTodosUsuarios] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});