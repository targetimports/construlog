import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Validar autenticação
    if (!user) {
      return Response.json({ ok: false, code: 'UNAUTHORIZED', message: 'Não autenticado' }, { status: 401 });
    }

    // Validar permissão (admin geral ou admin_empresa)
    const isAdmin = user.role === 'admin';
    const isCompanyAdmin = user.perfil_acesso === 'admin' || user.cargo === 'admin_empresa';

    if (!isAdmin && !isCompanyAdmin) {
      return Response.json({ ok: false, code: 'FORBIDDEN', message: 'Sem permissão para rejeitar usuários' }, { status: 403 });
    }

    // Parsear request
    const { userId, motivo } = await req.json();

    if (!userId) {
      return Response.json({ ok: false, code: 'INVALID_INPUT', message: 'userId obrigatório' }, { status: 400 });
    }

    // Buscar usuário a ser rejeitado
    const targetUser = await base44.asServiceRole.entities.User.read(userId);
    if (!targetUser) {
      return Response.json({ ok: false, code: 'NOT_FOUND', message: 'Usuário não encontrado' }, { status: 404 });
    }

    // Admin da empresa não pode rejeitar programadores
    if (!isAdmin && isCompanyAdmin) {
      const isProgramador = targetUser.role === 'programador' || 
                           targetUser.cargo === 'programador' ||
                           targetUser.perfil_acesso === 'programador';
      if (isProgramador) {
        return Response.json({ ok: false, code: 'FORBIDDEN', message: 'Não pode rejeitar programadores' }, { status: 403 });
      }
    }

    // Atualizar User via serviceRole
    const updated = await base44.asServiceRole.entities.User.update(userId, {
      status: 'rejeitado',
      status_acesso: 'rejeitado',
      rejected_at: new Date().toISOString(),
      rejected_by: user.email,
      rejection_reason: motivo || ''
    });

    // Atualizar AprovacaoUsuario se existir
    const aprovacoes = await base44.asServiceRole.entities.AprovacaoUsuario.filter({ user_email: targetUser.email });
    if (aprovacoes && aprovacoes.length > 0) {
      await base44.asServiceRole.entities.AprovacaoUsuario.update(aprovacoes[0].id, {
        status: 'rejeitado',
        status_acesso: 'rejeitado',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString(),
        observacoes: motivo || ''
      });
    }

    console.log(`[rejeitarUsuario] ${user.email} rejeitou ${targetUser.email}`);

    return Response.json({ 
      ok: true, 
      data: updated 
    });
  } catch (error) {
    console.error('[rejeitarUsuario] Error:', error);
    return Response.json({ 
      ok: false, 
      code: 'ERROR', 
      message: error.message 
    }, { status: 500 });
  }
});