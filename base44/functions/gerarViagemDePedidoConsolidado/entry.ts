import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pedido_id } = await req.json();

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id é obrigatório' }, { status: 400 });
    }

    // Buscar pedido
    const pedido = await base44.entities.PedidoCompra.list().then(list =>
      list.find(p => p.id === pedido_id)
    );

    if (!pedido) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Validar status (deve estar ENVIADO)
    if (pedido.status !== 'ENVIADO') {
      return Response.json(
        { error: `Pedido deve estar em status ENVIADO, atual: ${pedido.status}` },
        { status: 400 }
      );
    }

    // Buscar itens do pedido
    const itens = await base44.entities.PedidoCompraItem.list().then(list =>
      list.filter(i => i.pedido_id === pedido_id)
    );

    if (itens.length === 0) {
      return Response.json({ error: 'Pedido não possui itens' }, { status: 400 });
    }

    // Agrupar rateios por obra
    const obraMap = new Map();

    for (const item of itens) {
      // Buscar rateios do item (se existem)
      const rateios = await base44.entities.PedidoCompraItemRateio.list().then(list =>
        list.filter(r => r.pedido_item_id === item.id)
      );

      if (rateios.length === 0) {
        return Response.json(
          { error: `Item ${item.material_nome} não possui rateios por obra` },
          { status: 400 }
        );
      }

      // Organizar por obra
      for (const rateio of rateios) {
        if (!obraMap.has(rateio.obra_id)) {
          obraMap.set(rateio.obra_id, {
            obra_id: rateio.obra_id,
            obra_nome: rateio.obra_nome,
            local_estoque_id: rateio.local_estoque_id,
            local_estoque_nome: rateio.local_estoque_nome,
            itens: []
          });
        }

        obraMap.get(rateio.obra_id).itens.push({
          material_id: item.material_id,
          material_nome: item.material_nome,
          material_unidade: item.material_unidade,
          quantidade_planejada: rateio.quantidade_rateada,
          custo_unitario_estimado: item.preco_unitario || 0
        });
      }
    }

    // Validar que todas as obras têm local_estoque_id
    for (const obra of obraMap.values()) {
      if (!obra.local_estoque_id) {
        return Response.json(
          { error: `Obra ${obra.obra_nome} não possui local de estoque configurado` },
          { status: 400 }
        );
      }
    }

    // Criar Viagem
    const viagem = await base44.entities.Viagem.create({
      numero: `VG-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`,
      origem_tipo: 'FORNECEDOR',
      fornecedor_id: pedido.fornecedor_id,
      fornecedor_nome: pedido.fornecedor_nome,
      veiculo_descricao: '',
      motorista_nome: '',
      data_saida: new Date().toISOString(),
      status: 'PLANEJADA',
      observacao: `Gerada a partir do Pedido ${pedido.numero}`
    });

    // Criar ParadaViagem por obra (em ordem)
    let ordem = 1;
    const paradas = [];

    for (const [, obra] of obraMap) {
      const parada = await base44.entities.ParadaViagem.create({
        viagem_id: viagem.id,
        ordem: ordem++,
        obra_id: obra.obra_id,
        obra_nome: obra.obra_nome,
        local_estoque_id: obra.local_estoque_id,
        local_estoque_nome: obra.local_estoque_nome,
        status: 'PENDENTE'
      });

      paradas.push(parada);

      // Criar ParadaViagemItem para cada material da obra
      for (const item of obra.itens) {
        await base44.entities.ParadaViagemItem.create({
          parada_viagem_id: parada.id,
          material_id: item.material_id,
          material_nome: item.material_nome,
          material_unidade: item.material_unidade,
          quantidade_planejada: item.quantidade_planejada,
          quantidade_entregue: 0,
          custo_unitario_estimado: item.custo_unitario_estimado
        });
      }
    }

    return Response.json({
      success: true,
      viagem_id: viagem.id,
      viagem_numero: viagem.numero,
      paradas_count: paradas.length,
      message: `Viagem ${viagem.numero} criada com ${paradas.length} parada(s)`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});