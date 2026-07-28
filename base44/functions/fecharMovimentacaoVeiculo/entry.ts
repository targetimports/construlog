import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

    // Validar campos
    if (!payload.movimentacao_id || payload.km_final === undefined) {
      return Response.json({ error: 'movimentacao_id e km_final obrigatórios' }, { status: 400 });
    }

    // Buscar movimentação
    const movimentacao = await base44.asServiceRole.entities.MovimentacaoVeiculo.get(
      payload.movimentacao_id
    );

    if (!movimentacao) {
      return Response.json({ error: 'Movimentação não encontrada' }, { status: 404 });
    }

    // Validar status
    if (movimentacao.status !== 'ABERTA') {
      return Response.json(
        { error: 'Movimentação já está fechada' },
        { status: 400 }
      );
    }

    // Validar KM
    const kmFinal = parseFloat(payload.km_final);
    const kmInicial = parseFloat(movimentacao.km_inicial);

    if (kmFinal < kmInicial) {
      return Response.json(
        { error: 'KM final não pode ser menor que KM inicial' },
        { status: 400 }
      );
    }

    // Atualizar movimentação
    const movimentacaoAtualizada = await base44.entities.MovimentacaoVeiculo.update(
      payload.movimentacao_id,
      {
        retorno_hora: new Date().toISOString(),
        km_final: kmFinal,
        status: 'FECHADA'
      }
    );

    // Criar mídia se fornecida
    if (payload.midias && Array.isArray(payload.midias)) {
      for (const midia of payload.midias) {
        if (midia.arquivo_url) {
          await base44.entities.MovimentacaoVeiculoMidia.create({
            movimentacao_id: payload.movimentacao_id,
            tipo: midia.tipo || 'FOTO',
            arquivo_url: midia.arquivo_url,
            legenda: midia.legenda || `${midia.tipo} - ${new Date().toLocaleString('pt-BR')}`
          });
        }
      }
    }

    return Response.json({
      success: true,
      km_rodado: kmFinal - kmInicial,
      message: 'Movimentação fechada com sucesso'
    });
  } catch (error) {
    console.error('[fecharMovimentacaoVeiculo]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});