import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nf_id } = await req.json();

    if (!nf_id) {
      return Response.json({ error: 'nf_id inválido' }, { status: 400 });
    }

    // Buscar NF
    const nf = await base44.entities.NotaFiscal.read(nf_id);
    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    const valorTotal = nf.valor_final_ajustado || nf.valor_total || 0;

    // Buscar vínculos
    const vinculos = await base44.entities.NotaFiscalVinculo.filter(
      { documento_fiscal_id: nf_id },
      null,
      100
    );

    // Buscar pedido consolidado
    const pedidoVinculo = vinculos.find(v => v.referencia_tipo === 'PEDIDO');
    if (!pedidoVinculo) {
      return Response.json({ 
        error: 'NF não está vinculada a um Pedido',
        rateio: []
      }, { status: 400 });
    }

    const pedido = await base44.entities.PedidoCompra.read(pedidoVinculo.referencia_id);
    if (!pedido || !pedido.consolidado) {
      return Response.json({
        error: 'Pedido não é consolidado',
        rateio: []
      }, { status: 400 });
    }

    // Buscar itens do pedido
    const itens = await base44.entities.PedidoCompraItem.filter(
      { pedido_id: pedido.id },
      null,
      500
    );

    if (itens.length === 0) {
      return Response.json({ 
        error: 'Pedido não possui itens',
        rateio: []
      }, { status: 400 });
    }

    // Calcular rateio por obra baseado na quantidade rateada
    const mapRateioPorObra = {};

    for (const item of itens) {
      if (!item.rateio_obras || item.rateio_obras.length === 0) continue;

      // Total de quantidade rateada neste item
      const totalQtdItem = item.rateio_obras.reduce((sum, r) => sum + (r.quantidade || 0), 0);
      if (totalQtdItem === 0) continue;

      // Valor proporcional deste item no total
      const valorItemTotal = item.total_item || (item.preco_unitario * item.quantidade_pedida) || 0;
      const proporcaoItem = item.quantidade_pedida > 0 ? 1 : 0; // Simplificado

      // Distribuir entre obras
      for (const rateio of item.rateio_obras) {
        if (!mapRateioPorObra[rateio.obra_id]) {
          mapRateioPorObra[rateio.obra_id] = {
            obra_id: rateio.obra_id,
            obra_nome: rateio.obra_nome,
            qtd_total: 0,
            valor_estimado: 0
          };
        }

        mapRateioPorObra[rateio.obra_id].qtd_total += rateio.quantidade || 0;
        mapRateioPorObra[rateio.obra_id].valor_estimado += (
          (rateio.quantidade || 0) / totalQtdItem * valorItemTotal
        );
      }
    }

    // Converter para array
    const obras = Object.values(mapRateioPorObra);
    const somaEstimada = obras.reduce((sum, o) => sum + o.valor_estimado, 0);

    // Normalizar: distribuir valor_final_ajustado proporcionalmente
    const rateio = obras.map(obra => {
      const percentual = somaEstimada > 0 ? (obra.valor_estimado / somaEstimada) : (1 / obras.length);
      const valorRateado = percentual * valorTotal;

      return {
        documento_fiscal_id: nf_id,
        obra_id: obra.obra_id,
        obra_nome: obra.obra_nome,
        valor_rateado: Math.round(valorRateado * 100) / 100,
        percentual: Math.round(percentual * 10000) / 100
      };
    });

    // Limpar rateios anteriores
    const rateiosAntigos = await base44.entities.DocumentoFiscalRateio.filter(
      { documento_fiscal_id: nf_id },
      null,
      500
    );

    for (const r of rateiosAntigos) {
      await base44.entities.DocumentoFiscalRateio.delete(r.id);
    }

    // Salvar novos rateios
    const rateiosCriados = [];
    for (const r of rateio) {
      const criado = await base44.entities.DocumentoFiscalRateio.create(r);
      rateiosCriados.push(criado);
    }

    return Response.json({
      success: true,
      nf_id,
      valor_total: valorTotal,
      rateio: rateiosCriados,
      total_rateado: rateiosCriados.reduce((sum, r) => sum + r.valor_rateado, 0)
    });
  } catch (error) {
    console.error('Erro ao calcular rateio:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});