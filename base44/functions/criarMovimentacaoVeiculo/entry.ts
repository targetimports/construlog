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

    // Validar campos obrigatórios
    if (!payload.veiculo_id || !payload.km_inicial) {
      return Response.json(
        { error: 'veiculo_id e km_inicial são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar movimentação
    const movimentacao = await base44.entities.MovimentacaoVeiculo.create({
      veiculo_id: payload.veiculo_id,
      obra_origem_id: payload.obra_origem_id || null,
      obra_destino_id: payload.obra_destino_id || null,
      saida_hora: new Date().toISOString(),
      km_inicial: parseFloat(payload.km_inicial),
      motivo: payload.motivo || '',
      responsavel_id: user.email,
      status: 'ABERTA'
    });

    return Response.json({
      success: true,
      movimentacao_id: movimentacao.id,
      message: 'Movimentação aberta com sucesso'
    });
  } catch (error) {
    console.error('[criarMovimentacaoVeiculo]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});