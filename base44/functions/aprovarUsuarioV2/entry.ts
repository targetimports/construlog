import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function retryWithBackoff(fn, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      console.log(`[retryWithBackoff] Retry ${i + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'programador';
    const isCompanyAdmin = 
      user.perfil_acesso === 'admin' || 
      user.perfil_acesso === 'admin_empresa' ||
      user.cargo === 'admin_empresa' ||
      user.cargo === 'admin';

    if (!isAdmin && !isCompanyAdmin) {
      return Response.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    }

    const { userId, cargo, role } = await req.json();
    if (!userId) {
      return Response.json({ ok: false, error: 'userId obrigatório' }, { status: 400 });
    }

    console.log(`[aprovarUsuarioV2] Aprovando ${userId}, cargo=${cargo}, role=${role}`);

    // Se for órfão (exemplo: orphan-xxx), buscar na AprovacaoUsuario
    if (userId.startsWith('orphan-')) {
      const aprovacaoId = userId.replace('orphan-', '');
      const updated = await retryWithBackoff(() =>
        base44.asServiceRole.entities.AprovacaoUsuario.update(aprovacaoId, {
          status: 'ativo',
          status_acesso: 'aprovado',
          aprovado_por: user.email,
          data_aprovacao: new Date().toISOString()
        })
      );
      console.log('[aprovarUsuarioV2] Aprovação órfã atualizada');
      return Response.json({ ok: true, data: updated });
    }

    // Caso normal: User existe no sistema
    let targetUser = null;
    try {
      const usuarios = await retryWithBackoff(() =>
        base44.asServiceRole.entities.User.filter({ id: userId })
      );
      targetUser = usuarios?.[0];
    } catch (err) {
      console.error('[aprovarUsuarioV2] Filter error:', err);
    }
    
    if (!targetUser) {
      return Response.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Atualizar User com todos os campos (atômico)
    const updateData = {
      status: 'ativo',
      status_acesso: 'aprovado',
      approvedAt: new Date().toISOString(),
      approvedBy: user.email
    };

    if (cargo) updateData.cargo = cargo;
    if (role) updateData.role = role;

    console.log(`[aprovarUsuarioV2] Atualizando User ${userId} com:`, updateData);

    const updated = await retryWithBackoff(() =>
      base44.asServiceRole.entities.User.update(userId, updateData)
    );

    if (!updated) {
      return Response.json({ 
        ok: false, 
        message: 'Usuário não encontrado ou falhou ao atualizar. Verifique se o ID existe no banco.' 
      }, { status: 404 });
    }

    // Validar que a atualização foi realmente persistida
    const verificacao = await retryWithBackoff(() =>
      base44.asServiceRole.entities.User.filter({ id: userId })
    );
    
    const verificado = verificacao?.[0];
    if (!verificado || verificado.status !== 'ativo') {
      console.error('[aprovarUsuarioV2] Validação falhou! User não persistiu corretamente:', verificado);
      return Response.json({
        ok: false,
        message: 'Aprovação falhou na validação. User não foi atualizado no banco.'
      }, { status: 500 });
    }

    // Atualizar AprovacaoUsuario se existir
    const aprovacoes = await retryWithBackoff(() =>
      base44.asServiceRole.entities.AprovacaoUsuario
        .filter({ user_email: targetUser.email })
        .catch(() => [])
    );

    if (aprovacoes && aprovacoes.length > 0) {
      await retryWithBackoff(() =>
        base44.asServiceRole.entities.AprovacaoUsuario.update(aprovacoes[0].id, {
          status: 'ativo',
          status_acesso: 'aprovado',
          aprovado_por: user.email,
          data_aprovacao: new Date().toISOString()
        })
      );
    }

    console.log(`[aprovarUsuarioV2] ${targetUser.email} aprovado com sucesso. Snapshot:`, updated);
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    console.error('[aprovarUsuarioV2] Error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});