import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, insumo_id, tipo_movimentacao, quantidade, custo_unitario = 0, medicao_id, observacoes } = await req.json();

    if (!obra_id || !insumo_id || !tipo_movimentacao || !quantidade) {
      return Response.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 });
    }

    // 1️⃣ BUSCAR OU CRIAR ESTOQUE DA OBRA
    let estoques = await base44.entities.EstoqueObra.filter({ obra_id, insumo_id });
    let estoque = estoques?.[0];

    if (!estoque) {
      const insumos = await base44.entities.Insumo.filter({ id: insumo_id });
      const insumo = insumos?.[0];

      estoque = await base44.entities.EstoqueObra.create({
        obra_id,
        insumo_id,
        insumo_descricao: insumo?.descricao || 'Insumo',
        unidade: insumo?.unidade || 'un',
        quantidade_total: 0,
        quantidade_minima: 0,
        custo_unitario: custo_unitario || insumo?.preco_ultima_compra || 0
      });
    }

    // 2️⃣ PROCESSAR MOVIMENTAÇÃO
    let novaQuantidadeTotal = estoque.quantidade_total;

    if (tipo_movimentacao === 'entrada_compra' || tipo_movimentacao === 'entrada_transferencia') {
      novaQuantidadeTotal += quantidade;
    } else if (tipo_movimentacao === 'saida_consumo' || tipo_movimentacao === 'saida_devolucao') {
      novaQuantidadeTotal -= quantidade;
      if (novaQuantidadeTotal < 0) {
        return Response.json({
          error: `Quantidade insuficiente. Estoque: ${estoque.quantidade_total}, Solicitado: ${quantidade}`
        }, { status: 400 });
      }
    }

    // 3️⃣ REGISTRAR MOVIMENTAÇÃO
    const movimentacao = await base44.entities.MovimentacaoEstoqueObra.create({
      obra_id,
      estoque_obra_id: estoque.id,
      insumo_id,
      insumo_descricao: estoque.insumo_descricao,
      tipo_movimentacao,
      quantidade,
      unidade: estoque.unidade,
      custo_unitario: custo_unitario || estoque.custo_unitario,
      valor_total: quantidade * (custo_unitario || estoque.custo_unitario),
      data_movimentacao: new Date().toISOString().split('T')[0],
      responsavel: user.email,
      medicao_id,
      observacoes
    });

    // 4️⃣ ATUALIZAR ESTOQUE
    const novoValorTotal = novaQuantidadeTotal * (custo_unitario || estoque.custo_unitario);
    const novaQuantidadeDisponivel = novaQuantidadeTotal - (estoque.quantidade_reservada || 0);

    // Determinar status de alerta
    let statusAlerta = 'ok';
    if (estoque.quantidade_minima > 0) {
      if (novaQuantidadeTotal <= (estoque.quantidade_minima * 0.25)) {
        statusAlerta = 'critico';
      } else if (novaQuantidadeTotal <= estoque.quantidade_minima) {
        statusAlerta = 'alerta';
      }
    }

    await base44.entities.EstoqueObra.update(estoque.id, {
      quantidade_total: novaQuantidadeTotal,
      quantidade_disponivel: novaQuantidadeDisponivel,
      valor_total_estoque: novoValorTotal,
      data_ultima_movimentacao: new Date().toISOString(),
      status_alerta: statusAlerta,
      custo_unitario: custo_unitario || estoque.custo_unitario
    });

    return Response.json({
      sucesso: true,
      movimentacao_id: movimentacao.id,
      estoque_id: estoque.id,
      quantidade_anterior: estoque.quantidade_total,
      quantidade_nova: novaQuantidadeTotal,
      saldo_disponivel: novaQuantidadeDisponivel,
      valor_estoque: novoValorTotal,
      status_alerta: statusAlerta,
      mensagem: `Movimentação de ${tipo_movimentacao} processada com sucesso`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});