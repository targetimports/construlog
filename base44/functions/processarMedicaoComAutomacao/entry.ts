import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, item_orcamento_id, quantidade_medida } = await req.json();

    if (!obra_id || !item_orcamento_id || !quantidade_medida) {
      return Response.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 });
    }

    // 1️⃣ BUSCAR ITEM DO ORÇAMENTO
    const items = await base44.entities.OrcamentoItem.filter({ id: item_orcamento_id, obra_id });
    if (!items || items.length === 0) {
      return Response.json({ error: 'Item de orçamento não encontrado' }, { status: 404 });
    }

    const itemOrcamento = items[0];

    // 2️⃣ BUSCAR COMPOSIÇÃO VINCULADA
    if (!itemOrcamento.composicao_id) {
      return Response.json({ error: 'Item sem composição vinculada. Impossível processar medição.' }, { status: 400 });
    }

    const composicoes = await base44.entities.Composicao.filter({ id: itemOrcamento.composicao_id });
    if (!composicoes || composicoes.length === 0) {
      return Response.json({ error: 'Composição não encontrada' }, { status: 404 });
    }

    const composicao = composicoes[0];

    // 3️⃣ VALIDAR SALDO (não permitir medir acima do previsto)
    const medicoes = await base44.entities.Medicao.filter({ item_orcamento_id });
    const quantidadeMedidaAnterior = medicoes.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    const totalMedido = quantidadeMedidaAnterior + quantidade_medida;

    if (totalMedido > itemOrcamento.quantidade_prevista) {
      return Response.json({
        error: `Quantidade medida (${totalMedido}) excede o previsto (${itemOrcamento.quantidade_prevista})`
      }, { status: 400 });
    }

    // 4️⃣ BUSCAR INSUMOS DA COMPOSIÇÃO
    const insumosComposicao = await base44.entities.ComposicaoInsumo.filter({ 
      composicao_id: composicao.id 
    });

    if (!insumosComposicao || insumosComposicao.length === 0) {
      return Response.json({ error: 'Composição sem insumos definidos' }, { status: 400 });
    }

    // 5️⃣ REGISTRAR MEDIÇÃO
    const medicao = await base44.entities.Medicao.create({
      obra_id,
      item_orcamento_id,
      composicao_id: composicao.id,
      quantidade: quantidade_medida,
      data_medicao: new Date().toISOString(),
      usuario: user.email,
      status: 'confirmada'
    });

    // 6️⃣ CALCULAR E CONSUMIR INSUMOS PROPORCIONALMENTE
    const consumosRegistrados = [];
    let custoRealTotal = 0;

    for (const insumoComp of insumosComposicao) {
      // Coeficiente = quantidade de insumo por unidade
      const consumoQuantidade = quantidade_medida * insumoComp.coeficiente;
      
      // Buscar preço do insumo
      const insumos = await base44.entities.Insumo.filter({ id: insumoComp.insumo_id });
      const insumo = insumos?.[0];
      
      if (!insumo) continue;

      const preco = insumo.preco_ultima_compra || insumo.preco_referencia || 0;
      const custoInsumo = consumoQuantidade * preco;
      custoRealTotal += custoInsumo;

      // Registrar consumo
      const consumo = await base44.entities.ConsumoEstoqueObra.create({
        obra_id,
        item_orcamento_id,
        medicao_id: medicao.id,
        insumo_id: insumoComp.insumo_id,
        insumo_descricao: insumo.descricao,
        quantidade_consumida: consumoQuantidade,
        unidade: insumo.unidade,
        preco_unitario: preco,
        custo_total: custoInsumo,
        tipo_insumo: insumo.grupo
      });

      consumosRegistrados.push(consumo);

      // Se for equipamento/hora-máquina, registrar também em RegistroUsoEquipamento
      if (insumo.grupo === 'equipamento') {
        await base44.entities.RegistroUsoEquipamento.create({
          equipamento_id: insumoComp.insumo_id,
          obra_id,
          medicao_id: medicao.id,
          data_inicio: new Date().toISOString(),
          horas_trabalhadas: consumoQuantidade,
          tipo_uso: 'proprio',
          custo_total: custoInsumo,
          observacoes: `Consumido na medição de ${itemOrcamento.descricao}`
        });
      }
    }

    // 7️⃣ CONSUMIR ESTOQUE DA OBRA
    for (const consumo of consumosRegistrados) {
      try {
        await base44.functions.invoke('processarMovimentacaoEstoqueObra', {
          obra_id,
          insumo_id: consumo.insumo_id,
          tipo_movimentacao: 'saida_consumo',
          quantidade: consumo.quantidade_consumida,
          custo_unitario: consumo.preco_unitario,
          medicao_id: medicao.id,
          observacoes: `Consumo automático da medição`
        });
      } catch (error) {
        console.log(`Aviso: Não foi possível baixar estoque do insumo ${consumo.insumo_id}: ${error.message}`);
      }
    }

    // 8️⃣ ATUALIZAR ITEM DO ORÇAMENTO COM CUSTO REAL
    const quantidadeMedidaTotal = quantidadeMedidaAnterior + quantidade_medida;
    const custoMedioRealizado = custoRealTotal / quantidade_medida;
    const custoRealTotalItem = (await base44.entities.ConsumoEstoqueObra.filter({ 
      item_orcamento_id 
    })).reduce((sum, c) => sum + (c.custo_total || 0), 0);

    await base44.entities.OrcamentoItem.update(item_orcamento_id, {
      quantidade_executada: quantidadeMedidaTotal,
      custo_realizado_total: custoRealTotalItem,
      desvio_custo: custoRealTotalItem - (itemOrcamento.quantidade_prevista * itemOrcamento.valor_unitario),
      percentual_execucao: (quantidadeMedidaTotal / itemOrcamento.quantidade_prevista) * 100
    });

    // 9️⃣ ATUALIZAR RESUMO DA OBRA
    const todosItens = await base44.entities.OrcamentoItem.filter({ obra_id });
    const custoRealObraTotal = todosItens.reduce((sum, item) => sum + (item.custo_realizado_total || 0), 0);
    const orcamentoTotal = todosItens.reduce((sum, item) => sum + ((item.quantidade_prevista || 0) * (item.valor_unitario || 0)), 0);

    await base44.entities.ResumoObra.update(
      (await base44.entities.ResumoObra.filter({ obra_id }))[0]?.id,
      {
        custo_realizado_total: custoRealObraTotal,
        desvio_total: custoRealObraTotal - orcamentoTotal,
        percentual_execucao_financeira: (custoRealObraTotal / orcamentoTotal) * 100,
        data_ultima_atualizacao: new Date().toISOString()
      }
    );

    return Response.json({
      sucesso: true,
      medicao_id: medicao.id,
      quantidade_medida,
      custo_real_processado: custoRealTotal,
      insumos_consumidos: consumosRegistrados.length,
      mensagem: `Medição de ${quantidade_medida} processada com consumo automático de ${consumosRegistrados.length} insumos`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});