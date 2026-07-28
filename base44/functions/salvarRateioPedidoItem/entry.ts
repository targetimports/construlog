import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pedido_item_id, rateios } = await req.json();

    if (!pedido_item_id || !Array.isArray(rateios)) {
      return Response.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Buscar item para validação
    const item = await base44.entities.PedidoCompraItem.filter({ id: pedido_item_id });
    if (!item || item.length === 0) {
      return Response.json({ error: 'Item não encontrado' }, { status: 404 });
    }

    const itemData = item[0];

    // Validar rateios
    for (const rateio of rateios) {
      const qty = Number(rateio.quantidade) || 0;
      if (qty <= 0) {
        return Response.json(
          { error: `Rateio de "${rateio.obra_nome}" deve ser maior que zero` },
          { status: 400 }
        );
      }
      if (qty > itemData.quantidade_pedida) {
        return Response.json(
          { error: `Rateio de "${rateio.obra_nome}" (${qty}) excede total do item (${itemData.quantidade_pedida})` },
          { status: 400 }
        );
      }
    }

    // Validar soma total
    const somaRateios = rateios.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);
    if (Math.abs(somaRateios - itemData.quantidade_pedida) > 0.01) {
      return Response.json(
        { error: `Soma dos rateios (${somaRateios}) não bate com total do item (${itemData.quantidade_pedida})` },
        { status: 400 }
      );
    }

    // Remover rateios existentes
    const existentes = await base44.entities.PedidoCompraItemRateio.filter({
      pedido_item_id: pedido_item_id,
    });
    for (const e of existentes) {
      await base44.entities.PedidoCompraItemRateio.delete(e.id);
    }

    // Criar novos rateios
    for (const rateio of rateios) {
      await base44.entities.PedidoCompraItemRateio.create({
        pedido_item_id: pedido_item_id,
        obra_id: rateio.obra_id,
        obra_nome: rateio.obra_nome,
        quantidade_rateada: rateio.quantidade,
        local_estoque_id: rateio.local_estoque_id || null,
        local_estoque_nome: rateio.local_estoque_nome || null,
        observacao: rateio.observacao || null,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[salvarRateioPedidoItem]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});