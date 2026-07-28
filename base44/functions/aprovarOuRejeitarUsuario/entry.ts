import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica se é admin geral ou admin de empresa
    const isAdmin = user.role === 'admin';
    const isCompanyAdmin = user.isCompanyAdmin || user.perfil_acesso === 'admin' || user.cargo === 'admin_empresa';

    if (!isAdmin && !isCompanyAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, data } = body;

    if (!userId || !data) {
      return Response.json({ error: 'Missing userId or data' }, { status: 400 });
    }

    // Busca o usuário User para pegar o email
    const usuarioUser = await base44.asServiceRole.entities.User.get(userId);
    if (!usuarioUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Salva dados de aprovação na tabela AprovacaoUsuario
    const dataAtualizacao = {
      user_email: usuarioUser.email,
      status: data.status || 'pendente',
      full_name: data.full_name || usuarioUser.full_name || '',
      telefone: data.telefone || '',
      cargo: data.cargo || '',
      empresa: data.empresa || '',
      perfil_acesso: data.perfil_acesso || 'campo',
      status_acesso: data.status_acesso || 'pendente',
      observacoes: data.observacoes || '',
      aprovado_por: data.status === 'ativo' ? user.email : undefined,
      data_aprovacao: data.status === 'ativo' ? new Date().toISOString() : undefined
    };

    // Remove undefined values
    Object.keys(dataAtualizacao).forEach(k => dataAtualizacao[k] === undefined && delete dataAtualizacao[k]);

    // Busca se já existe registro de aprovação
    const aprovacaoExistente = await base44.asServiceRole.entities.AprovacaoUsuario.filter({ user_email: usuarioUser.email });

    let resultado;
    if (aprovacaoExistente && aprovacaoExistente.length > 0) {
      // Atualiza registro existente
      resultado = await base44.asServiceRole.entities.AprovacaoUsuario.update(aprovacaoExistente[0].id, dataAtualizacao);
    } else {
      // Cria novo registro
      resultado = await base44.asServiceRole.entities.AprovacaoUsuario.create(dataAtualizacao);
    }

    console.log('[aprovarOuRejeitarUsuario] Success:', resultado);
    return Response.json(resultado);
  } catch (error) {
    console.error('[aprovarOuRejeitarUsuario] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});