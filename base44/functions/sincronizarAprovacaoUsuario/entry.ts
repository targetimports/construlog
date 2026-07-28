import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const isSuperAdmin = user?.role === 'admin' || user?.role === 'programador';
    const isCompanyAdmin = user?.perfil_acesso === 'admin' || user?.cargo === 'admin_empresa' || user?.isCompanyAdmin;
    if (!user || (!isSuperAdmin && !isCompanyAdmin)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userEmail } = await req.json();

    if (!userEmail) {
      return Response.json({ error: 'userEmail required' }, { status: 400 });
    }

    // Buscar AprovacaoUsuario
    const aprovacoes = await base44.asServiceRole.entities.AprovacaoUsuario.filter({ user_email: userEmail });
    
    if (!aprovacoes || aprovacoes.length === 0) {
      return Response.json({ error: 'AprovacaoUsuario not found' }, { status: 404 });
    }

    const aprovacao = aprovacoes[0];

    // Buscar User por email
    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userRecord = users[0];

    // Sincronizar status com User entity
    const result = await base44.asServiceRole.entities.User.update(userRecord.id, {
      status_acesso: aprovacao.status_acesso,
      status: aprovacao.status,
      full_name: aprovacao.full_name || userRecord.full_name,
      telefone: aprovacao.telefone,
      cargo: aprovacao.cargo,
      empresa: aprovacao.empresa,
      perfil_acesso: aprovacao.perfil_acesso,
      observacoes: aprovacao.observacoes
    });

    console.log('[sincronizarAprovacaoUsuario] Sincronizado:', userEmail, result);
    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('[sincronizarAprovacaoUsuario] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});