import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { vinculo_id, motivo_rejeicao } = body;

    if (!vinculo_id || !motivo_rejeicao) {
      return Response.json({
        error: 'vinculo_id e motivo_rejeicao são obrigatórios'
      }, { status: 400 });
    }

    const vinculo = await base44.entities.VinculacaoOrcamentoEstoque.read(vinculo_id);
    if (!vinculo) {
      return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
    }

    await base44.entities.VinculacaoOrcamentoEstoque.update(vinculo_id, {
      status: 'rejeitado',
      motivo_rejeicao,
      historico_mudancas: [
        ...(vinculo.historico_mudancas || []),
        {
          data: new Date().toISOString(),
          acao: 'vinculo_rejeitado',
          usuario: user.email,
          detalhes: motivo_rejeicao
        }
      ]
    });

    return Response.json({
      vinculo_id,
      status: 'rejeitado',
      mensagem: 'Vínculo rejeitado. Continuar pesquisando outras correspondências.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});