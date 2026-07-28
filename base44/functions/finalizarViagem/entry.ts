import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { viagem_id, km_final, combustivel_final_percent, observacoes } = await req.json();

    if (!viagem_id) {
      return Response.json({ error: 'viagem_id obrigatório' }, { status: 400 });
    }

    const viagens = await base44.entities.Viagem.list();
    const viagem = viagens.find(v => v.id === viagem_id);

    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    // Validar permissão
    if (viagem.motorista_user_id !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Atualizar viagem
    const viagemAtualizada = await base44.entities.Viagem.update(
      viagem_id,
      {
        status: 'finalizada',
        retorno_real: new Date().toISOString(),
        km_final: km_final || null,
        combustivel_final_percent: combustivel_final_percent || null,
        observacoes: observacoes || ''
      }
    );

    // Atualizar solicitação para concluída
    const solicitacoes = await base44.entities.SolicitacaoVeiculo.list();
    const solicitacao = solicitacoes.find(s => s.id === viagem.solicitacao_id);
    
    if (solicitacao) {
      await base44.entities.SolicitacaoVeiculo.update(
        solicitacao.id,
        { status: 'concluida' }
      );
    }

    return Response.json({
      success: true,
      viagem: viagemAtualizada
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});