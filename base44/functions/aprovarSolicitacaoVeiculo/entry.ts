import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { solicitacao_id, veiculo_id, motorista_user_id } = await req.json();

    if (!solicitacao_id || !veiculo_id || !motorista_user_id) {
      return Response.json({ error: 'veiculo_id e motorista_user_id obrigatórios' }, { status: 400 });
    }

    // Validar permissão: admin ou logística/supervisor
    const permissoes = await base44.entities.PermissaoUsuario.filter({
      user_email: user.email
    });
    
    const temPermissao = user.role === 'admin' || 
                         permissoes.some(p => ['logistica', 'supervisor', 'gerente'].includes(p.cargo));

    if (!temPermissao) {
      return Response.json({ error: 'Sem permissão para aprovar' }, { status: 403 });
    }

    const solicitacoes = await base44.entities.SolicitacaoVeiculo.list();
    const solicitacao = solicitacoes.find(s => s.id === solicitacao_id);

    if (!solicitacao) {
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    // Atualizar solicitação
    const solicitacaoAtualizada = await base44.entities.SolicitacaoVeiculo.update(
      solicitacao_id,
      {
        status: 'aprovada',
        veiculo_id,
        motorista_user_id,
        aprovado_por_user_id: user.email
      }
    );

    // Criar Viagem automaticamente
    const viagem = await base44.entities.Viagem.create({
      solicitacao_id,
      obra_id: solicitacao.obra_id || null,
      cliente_id: solicitacao.cliente_id || null,
      veiculo_id,
      motorista_user_id,
      status: 'aguardando_saida'
    });

    return Response.json({
      success: true,
      solicitacao: solicitacaoAtualizada,
      viagem
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});