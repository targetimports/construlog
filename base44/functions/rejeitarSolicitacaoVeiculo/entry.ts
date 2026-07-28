import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { solicitacao_id, motivo } = await req.json();

    if (!solicitacao_id) {
      return Response.json({ error: 'solicitacao_id obrigatório' }, { status: 400 });
    }

    // Validar permissão
    const permissoes = await base44.entities.PermissaoUsuario.filter({
      user_email: user.email
    });
    
    const temPermissao = user.role === 'admin' || 
                         permissoes.some(p => ['logistica', 'supervisor', 'gerente'].includes(p.cargo));

    if (!temPermissao) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const atualizada = await base44.entities.SolicitacaoVeiculo.update(
      solicitacao_id,
      {
        status: 'rejeitada',
        motivo_rejeicao: motivo || '',
        aprovado_por_user_id: user.email
      }
    );

    return Response.json({
      success: true,
      solicitacao: atualizada
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});