import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, orcamento_item_id, quantidade_medida } = await req.json();
    if (!obra_id || !orcamento_item_id || !quantidade_medida) {
      return Response.json({ error: 'Parâmetros obrigatórios' }, { status: 400 });
    }

    // 1. Buscar item do orçamento
    const items = await base44.entities.OrcamentoItem.filter({ id: orcamento_item_id });
    if (items.length === 0) return Response.json({ error: 'Item não encontrado' }, { status: 404 });
    const item = items[0];

    // 2. Validar saldo disponível
    const saldo_disponivel = item.quantidade - (item.quantidade_executada || 0);
    if (quantidade_medida > saldo_disponivel) {
      return Response.json({ 
        error: `Quantidade maior que saldo. Disponível: ${saldo_disponivel}`,
        saldo_disponivel 
      }, { status: 400 });
    }

    // 3. Buscar composição vinculada
    const composicoes = await base44.entities.Composicao.filter({ 
      orcamento_item_id 
    });
    if (composicoes.length === 0) {
      return Response.json({ error: 'Composição não vinculada' }, { status: 400 });
    }
    const composicao = composicoes[0];

    // 4. Criar medição
    const medicao = await base44.entities.Medicao.create({
      obra_id,
      orcamento_item_id,
      quantidade_medida,
      data_medicao: new Date().toISOString().split('T')[0],
      responsavel: user.email,
      status: 'em_processamento'
    });

    // 5. Buscar insumos da composição
    const insumos_composicao = await base44.entities.ComposicaoInsumo.filter({
      composicao_id: composicao.id
    });

    let custo_total_material = 0;
    let custo_total_mao_obra = 0;
    let custo_total_equipamento = 0;
    const movimentacoes = [];

    // 6. Processar consumo de insumos
    for (const ins_comp of insumos_composicao) {
      const quantidade_consumida = quantidade_medida * (ins_comp.quantidade || 1);
      const valor_consumo = quantidade_consumida * (ins_comp.valor_unitario || 0);

      // Buscar insumo
      const insumos = await base44.entities.Insumo.filter({ 
        id: ins_comp.insumo_id 
      });
      const insumo = insumos[0];

      // Categorizar custo
      if (insumo.tipo === 'material') {
        custo_total_material += valor_consumo;
      } else if (insumo.tipo === 'mao_obra') {
        custo_total_mao_obra += valor_consumo;
      }

      // Registrar movimentação de estoque (saída de consumo)
      await base44.entities.MovimentacaoEstoque.create({
        insumo_id: ins_comp.insumo_id,
        tipo: 'saida_consumo',
        quantidade: quantidade_consumida,
        almoxarifado_origem_id: 'principal',
        obra_destino_id: obra_id,
        data_movimentacao: new Date().toISOString().split('T')[0],
        responsavel: user.email,
        custo_unitario: ins_comp.valor_unitario,
        valor_total: valor_consumo
      });

      movimentacoes.push({
        insumo: insumo.descricao,
        tipo: insumo.tipo,
        quantidade: quantidade_consumida,
        valor: valor_consumo
      });
    }

    // 7. Processar hora-máquina
    let horas_utilizadas = 0;
    if (composicao.hora_maquina_coeficiente || composicao.produtividade) {
      if (composicao.produtividade) {
        horas_utilizadas = quantidade_medida / composicao.produtividade;
      } else {
        horas_utilizadas = quantidade_medida * (composicao.hora_maquina_coeficiente || 0);
      }

      // Buscar equipamento vinculado
      if (composicao.equipamento_id) {
        const equipamentos = await base44.entities.Equipamento.filter({
          id: composicao.equipamento_id
        });
        const equipamento = equipamentos[0];

        // Criar registro de uso
        await base44.entities.RegistroUsoEquipamento.create({
          equipamento_id: composicao.equipamento_id,
          obra_id,
          data_inicio: new Date().toISOString(),
          data_fim: new Date().toISOString(),
          horas_trabalhadas: horas_utilizadas,
          tipo_uso: 'proprio',
          custo_total: horas_utilizadas * (equipamento.custo_hora || 0)
        });

        custo_total_equipamento = horas_utilizadas * (equipamento.custo_hora || 0);
      }
    }

    // 8. Criar lançamento financeiro para custo real
    const valor_total_custo = custo_total_material + custo_total_mao_obra + custo_total_equipamento;
    
    const lancamento = await base44.entities.LancamentoFinanceiro.create({
      obra_id,
      data: new Date().toISOString().split('T')[0],
      tipo: 'despesa',
      categoria: 'custo_medicao',
      descricao: `Custo real medição - Item ${item.descricao}`,
      valor: valor_total_custo,
      orcamento_item_id,
      medicao_id: medicao.id,
      status: 'confirmado'
    });

    // 9. Atualizar item do orçamento
    const nova_quantidade_executada = (item.quantidade_executada || 0) + quantidade_medida;
    const novo_custo_realizado = (item.custo_realizado || 0) + valor_total_custo;
    const custo_previsto = item.quantidade * (item.valor_unitario || 0);
    const desvio_percentual = ((novo_custo_realizado - custo_previsto) / custo_previsto * 100).toFixed(2);

    await base44.entities.OrcamentoItem.update(orcamento_item_id, {
      quantidade_executada: nova_quantidade_executada,
      custo_realizado: novo_custo_realizado,
      desvio_percentual
    });

    // 10. Finalizar medição
    await base44.entities.Medicao.update(medicao.id, {
      status: 'processada',
      custo_material: custo_total_material,
      custo_mao_obra: custo_total_mao_obra,
      custo_equipamento: custo_total_equipamento,
      custo_total: valor_total_custo,
      horas_equipamento: horas_utilizadas,
      lancamento_id: lancamento.id
    });

    // 11. Atualizar resumo da obra
    const resumos = await base44.entities.ResumoObra.filter({ obra_id });
    if (resumos.length > 0) {
      const resumo = resumos[0];
      await base44.entities.ResumoObra.update(resumo.id, {
        custo_realizado_total: (resumo.custo_realizado_total || 0) + valor_total_custo,
        quantidade_medida_total: (resumo.quantidade_medida_total || 0) + quantidade_medida
      });
    }

    return Response.json({
      status: 'sucesso',
      medicao_id: medicao.id,
      quantidade_medida,
      custo_material: custo_total_material,
      custo_mao_obra: custo_total_mao_obra,
      custo_equipamento: custo_total_equipamento,
      custo_total: valor_total_custo,
      horas_equipamento: horas_utilizadas,
      movimentacoes,
      novo_saldo: saldo_disponivel - quantidade_medida,
      desvio_percentual
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});