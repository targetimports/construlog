import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pedido, itens, enviar } = await req.json();

    if (!pedido || !itens || !Array.isArray(itens)) {
      return Response.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Validar se está enviando (ENVIAR) e é consolidado
    if (enviar && pedido.consolidado) {
      for (const item of itens) {
        if (!item.rateio_obras || item.rateio_obras.length === 0) {
          return Response.json(
            { error: `Item "${item.material_nome}" não tem rateio definido` },
            { status: 400 }
          );
        }

        // Validar soma do rateio = quantidade_pedida
        const somaRateio = item.rateio_obras.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);
        if (Math.abs(somaRateio - item.quantidade_pedida) > 0.01) {
          return Response.json(
            { error: `Rateio do item "${item.material_nome}" (${somaRateio}) não bate com total (${item.quantidade_pedida})` },
            { status: 400 }
          );
        }
      }
    }

    // Salvar ou atualizar pedido
    let savedPedido;
    if (pedido.id) {
      // Atualizar
      savedPedido = await base44.entities.PedidoCompra.update(pedido.id, {
        consolidado: pedido.consolidado,
        fornecedor_id: pedido.fornecedor_id,
        obra_id: pedido.obra_id,
        data_pedido: pedido.data_pedido,
        previsao_entrega: pedido.previsao_entrega,
        condicao_pagamento: pedido.condicao_pagamento,
        observacao: pedido.observacao,
        status: enviar ? 'ENVIADO' : 'RASCUNHO',
      });
    } else {
      // Criar novo
      savedPedido = await base44.entities.PedidoCompra.create({
        consolidado: pedido.consolidado,
        fornecedor_id: pedido.fornecedor_id,
        obra_id: pedido.obra_id,
        data_pedido: pedido.data_pedido,
        previsao_entrega: pedido.previsao_entrega,
        condicao_pagamento: pedido.condicao_pagamento,
        observacao: pedido.observacao,
        status: enviar ? 'ENVIADO' : 'RASCUNHO',
      });
    }

    // Salvar itens do pedido
    for (const item of itens) {
      if (item.id) {
        // Atualizar item
        await base44.entities.PedidoCompraItem.update(item.id, {
          material_id: item.material_id,
          quantidade_pedida: item.quantidade_pedida,
          preco_unitario: item.preco_unitario,
          total_item: item.total_item,
        });
      } else {
        // Criar novo item
        const newItem = await base44.entities.PedidoCompraItem.create({
          pedido_id: savedPedido.id,
          material_id: item.material_id,
          material_nome: item.material_nome,
          material_unidade: item.material_unidade,
          quantidade_pedida: item.quantidade_pedida,
          preco_unitario: item.preco_unitario,
          total_item: item.total_item,
        });
        item.id = newItem.id; // Usar ID do novo item criado
      }

      // Salvar rateios se for consolidado
      if (item.rateio_obras && item.rateio_obras.length > 0) {
        // Remover rateios existentes para este item
        const existentes = await base44.entities.PedidoCompraItemRateio.filter({
          pedido_item_id: item.id,
        });
        for (const e of existentes) {
          await base44.entities.PedidoCompraItemRateio.delete(e.id);
        }

        // Criar novos rateios
        for (const rateio of item.rateio_obras) {
          await base44.entities.PedidoCompraItemRateio.create({
            pedido_item_id: item.id,
            obra_id: rateio.obra_id,
            obra_nome: rateio.obra_nome,
            quantidade_rateada: rateio.quantidade,
            local_estoque_id: rateio.local_estoque_id || null,
            local_estoque_nome: rateio.local_estoque_nome || null,
            observacao: rateio.observacao || null,
          });
        }
      }
    }

    // Calcular valor total
    const valorTotal = itens.reduce((acc, item) => acc + (item.total_item || 0), 0);
    await base44.entities.PedidoCompra.update(savedPedido.id, { valor_total: valorTotal });

    return Response.json({ success: true, pedido_id: savedPedido.id });
  } catch (error) {
    console.error('[salvarPedidoCompraConsolidado]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});