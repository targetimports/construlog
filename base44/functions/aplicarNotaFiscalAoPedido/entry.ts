import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { pedidoId, dadosNF, sugestoes, pedidoDataAtual } = payload;

    if (!pedidoId || !dadosNF) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch pedido atual
    const pedido = await base44.entities.PedidoCompra.get(pedidoId);
    if (!pedido) {
      return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Rastrear mudanças
    const mudancas = [];
    const pedidoAtualizado = { ...pedido };

    // ===== 1. APLICAR FORNECEDOR =====
    if (sugestoes?.fornecedor) {
      // Tentar encontrar fornecedor por CNPJ
      const cnpjNF = sugestoes.fornecedor.fornecedor_cnpj?.replace(/\D/g, '');
      const fornecedoresExistentes = await base44.entities.Fornecedor.filter({});

      let fornecedorEncontrado = null;
      if (cnpjNF) {
        fornecedorEncontrado = fornecedoresExistentes.find(
          (f) => f.cnpj?.replace(/\D/g, '') === cnpjNF
        );
      }

      if (fornecedorEncontrado) {
        // Usar fornecedor existente
        if (pedidoAtualizado.fornecedor_id !== fornecedorEncontrado.id) {
          pedidoAtualizado.fornecedor_id = fornecedorEncontrado.id;
          pedidoAtualizado.fornecedor_nome = fornecedorEncontrado.razao_social;
          pedidoAtualizado.fornecedor_cnpj = fornecedorEncontrado.cnpj;
          mudancas.push({
            campo: 'fornecedor',
            anterior: pedido.fornecedor_nome,
            novo: fornecedorEncontrado.razao_social,
            tipo: 'SUBSTITUIDO',
          });
        }
      } else {
        // Apenas atualizar dados de nome/CNPJ se diferentes
        if (pedidoAtualizado.fornecedor_nome !== sugestoes.fornecedor.fornecedor_nome) {
          pedidoAtualizado.fornecedor_nome = sugestoes.fornecedor.fornecedor_nome;
          mudancas.push({
            campo: 'fornecedor_nome',
            anterior: pedido.fornecedor_nome,
            novo: sugestoes.fornecedor.fornecedor_nome,
            tipo: 'ATUALIZADO',
          });
        }
        if (pedidoAtualizado.fornecedor_cnpj !== sugestoes.fornecedor.fornecedor_cnpj) {
          pedidoAtualizado.fornecedor_cnpj = sugestoes.fornecedor.fornecedor_cnpj;
          mudancas.push({
            campo: 'fornecedor_cnpj',
            anterior: pedido.fornecedor_cnpj,
            novo: sugestoes.fornecedor.fornecedor_cnpj,
            tipo: 'ATUALIZADO',
          });
        }
      }
    }

    // ===== 2. APLICAR ITENS (COM SUPORTE A MULTI-OBRA) =====
    if (sugestoes?.itens && Array.isArray(sugestoes.itens)) {
      const itensPedidoAtualizado = (pedidoAtualizado.itens || []).map((itemPedido) => {
        // Encontrar item correspondente na NF
        const itemNF = sugestoes.itens.find((in) =>
          in.descricao?.toLowerCase().includes(itemPedido.descricao?.toLowerCase().substring(0, 10))
        );

        if (itemNF) {
          const itemAtualizado = { ...itemPedido };
          const mudançasItem = {};
          const qtdAntiga = itemPedido.quantidade;

          // Atualizar quantidade se divergir
          if (Math.abs(itemPedido.quantidade - itemNF.quantidade) > 0.01) {
            itemAtualizado.quantidade = itemNF.quantidade;
            mudançasItem.quantidade = { anterior: itemPedido.quantidade, novo: itemNF.quantidade };
          }

          // Atualizar preço unitário se existir na NF e divergir
          if (itemNF.valor_unitario && Math.abs((itemPedido.valor_unitario || 0) - itemNF.valor_unitario) > 0.01) {
            itemAtualizado.valor_unitario = itemNF.valor_unitario;
            mudançasItem.valor_unitario = { anterior: itemPedido.valor_unitario, novo: itemNF.valor_unitario };
          }

          // Recalcular valor total
          itemAtualizado.valor_total = itemAtualizado.quantidade * (itemAtualizado.valor_unitario || 0);

          // ===== MULTI-OBRA: PRESERVAR E AJUSTAR RATEIOS =====
          if (itemPedido.rateios && Array.isArray(itemPedido.rateios) && itemPedido.rateios.length > 0) {
            // Se quantidade mudou, proporcionar rateio mantendo proporções
            if (Math.abs(qtdAntiga - itemAtualizado.quantidade) > 0.01) {
              const fatorAjuste = itemAtualizado.quantidade / qtdAntiga;
              itemAtualizado.rateios = itemPedido.rateios.map((r) => ({
                ...r,
                quantidade: r.quantidade * fatorAjuste,
              }));
              mudançasItem.rateio_ajustado = `Proporção ajustada por fator ${fatorAjuste.toFixed(2)}`;
            } else {
              itemAtualizado.rateios = itemPedido.rateios;
            }
          }

          // Registrar mudança
          if (Object.keys(mudançasItem).length > 0) {
            mudancas.push({
              campo: 'item',
              descricao: itemPedido.descricao,
              detalhe: mudançasItem,
              tipo: 'ATUALIZADO',
            });
          }

          return itemAtualizado;
        }

        return itemPedido;
      });

      // Adicionar itens novos da NF que não existem no pedido
      const itensNovos = sugestoes.itens.filter(
        (itemNF) =>
          !(pedidoAtualizado.itens || []).some((ip) =>
            ip.descricao?.toLowerCase().includes(itemNF.descricao?.toLowerCase().substring(0, 10))
          )
      );

      if (itensNovos.length > 0) {
        const itensNovosMapeados = itensNovos.map((item) => ({
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.quantidade * item.valor_unitario,
          origem_nf: true, // Marcar como vindo de NF
          // Se pedido é multi-obra, novos itens começam sem rateio (usuário deve definir)
          rateios: [],
        }));

        itensPedidoAtualizado.push(...itensNovosMapeados);

        mudancas.push({
          campo: 'itens_novos',
          quantidade: itensNovos.length,
          obs: 'Para pedidos multi-obra, novos itens requerem rateio manual',
          tipo: 'ADICIONADO',
        });
      }

      pedidoAtualizado.itens = itensPedidoAtualizado;
    }

    // ===== 3. RECALCULAR TOTAIS =====
    const valorTotalAtualizado = (pedidoAtualizado.itens || []).reduce((sum, it) => sum + (it.valor_total || 0), 0);
    if (Math.abs((pedidoAtualizado.valor_total || 0) - valorTotalAtualizado) > 0.01) {
      mudancas.push({
        campo: 'valor_total',
        anterior: pedidoAtualizado.valor_total,
        novo: valorTotalAtualizado,
        tipo: 'RECALCULADO',
      });
      pedidoAtualizado.valor_total = valorTotalAtualizado;
    }

    // ===== 4. ATUALIZAR STATUS DE CONFERÊNCIA NF =====
    pedidoAtualizado.status_nf = 'CONFERIDO';
    pedidoAtualizado.status_nf_data = new Date().toISOString();
    pedidoAtualizado.status_nf_usuario = user.email;

    // ===== 5. GRAVAR PEDIDO ATUALIZADO =====
    await base44.entities.PedidoCompra.update(pedidoId, pedidoAtualizado);

    // ===== 6. REGISTRAR AUDITORIA =====
    await base44.entities.LogAuditoria.create({
      entidade: 'PedidoCompra',
      entidade_id: pedidoId,
      usuario_email: user.email,
      acao: 'APLICAR_NOTA_FISCAL',
      descricao: `Dados de NF aplicados ao pedido. ${mudancas.length} mudança(s). Status NF: CONFERIDO`,
      detalhes: JSON.stringify(mudancas),
      data_hora: new Date().toISOString(),
    });

    return Response.json({
      sucesso: true,
      pedidoId,
      mudancas,
      pedidoAtualizado,
    });
  } catch (error) {
    console.error('[aplicarNotaFiscalAoPedido]', error);
    return Response.json(
      {
        sucesso: false,
        erro: error.message,
      },
      { status: 500 }
    );
  }
});