import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { obra_id, de, ate } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    const dataFim = ate ? new Date(ate) : new Date();
    const dataInicio = de ? new Date(de) : new Date(dataFim.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Buscar movimentações de saída_consumo para obra
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      obra_destino_id: obra_id,
      tipo: 'saida_consumo'
    }, '-data_movimentacao', 500);

    const consumoPorInsumo = {};
    movimentacoes.forEach(mov => {
      const movDate = new Date(mov.data_movimentacao);
      if (movDate >= dataInicio && movDate <= dataFim) {
        if (!consumoPorInsumo[mov.insumo_id]) {
          consumoPorInsumo[mov.insumo_id] = {
            insumo_id: mov.insumo_id,
            quantidade: 0,
            valor: 0
          };
        }
        consumoPorInsumo[mov.insumo_id].quantidade += mov.quantidade || 0;
        consumoPorInsumo[mov.insumo_id].valor += mov.valor_total || 0;
      }
    });

    // Enriquecer com dados de insumo
    const resultado = [];
    for (const [insumoId, dados] of Object.entries(consumoPorInsumo)) {
      const insumo = await base44.entities.Insumo.filter({ id: insumoId }).then(r => r[0]);
      resultado.push({
        ...dados,
        descricao: insumo?.descricao || 'N/A',
        unidade: insumo?.unidade || 'un',
        tipo: insumo?.tipo || 'material'
      });
    }

    return Response.json({
      ok: true,
      obra_id,
      periodo: { de: dataInicio.toISOString().split('T')[0], ate: dataFim.toISOString().split('T')[0] },
      consumo: resultado.sort((a, b) => b.valor - a.valor)
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});