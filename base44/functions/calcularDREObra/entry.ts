import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { obra_id } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // ============ RECEITAS ============
    
    // 1. Receita contratada (ReceitaObra tipo=contrato)
    const receitasContrato = await base44.asServiceRole.entities.ReceitaObra.filter({
      obra_id,
      tipo: 'contrato',
      status: { $ne: 'cancelada' }
    });
    const receitaContratada = receitasContrato?.reduce((sum, r) => sum + (r.valor_liquido || 0), 0) || 0;

    // 2. Receita faturada (status=faturado)
    const receitasFaturadas = await base44.asServiceRole.entities.ReceitaObra.filter({
      obra_id,
      status: 'faturado'
    });
    const receitaFaturada = receitasFaturadas?.reduce((sum, r) => sum + (r.valor_liquido || 0), 0) || 0;

    // 3. Receita recebida (status=recebido)
    const receitasRecebidas = await base44.asServiceRole.entities.ReceitaObra.filter({
      obra_id,
      status: 'recebido'
    });
    const receitaRecebida = receitasRecebidas?.reduce((sum, r) => sum + (r.valor_liquido || 0), 0) || 0;

    // ============ CUSTOS REAIS ============

    // 1. Materiais: ConsumoInsumo × custo médio do insumo
    const consumos = await base44.asServiceRole.entities.ConsumoInsumo.filter({
      obra_id
    });
    let custoMateriais = 0;
    if (consumos) {
      for (const consumo of consumos) {
        custoMateriais += (consumo.quantidade_consumida || 0) * (consumo.valor_unitario || 0);
      }
    }

    // 2. Mão de obra: apontamentos de horas + valor/hora dos colaboradores
    let custoMaoObra = 0;
    try {
      const apontamentos = await base44.asServiceRole.entities.ApontamentoHoras.filter({
        obra_id
      });
      if (apontamentos) {
        for (const ap of apontamentos) {
          custoMaoObra += (ap.horas || 0) * (ap.valor_hora || 0);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar apontamentos:', err.message);
    }

    // 3. Equipamentos: UsoEquipamento
    const usos = await base44.asServiceRole.entities.UsoEquipamento.filter({
      obra_id
    });
    const custoEquipamentos = usos?.reduce((sum, u) => sum + (u.valor_total || 0), 0) || 0;

    // 4. Despesas indiretas: lançamentos financeiros tipo=despesa vinculados à obra
    let custoIndiretas = 0;
    try {
      const lancamentos = await base44.asServiceRole.entities.LancamentoFinanceiro.filter({
        obra_id,
        tipo: { $in: ['combustivel', 'frete', 'despesa', 'logistica'] }
      });
      if (lancamentos) {
        custoIndiretas = lancamentos.reduce((sum, l) => sum + (l.valor || 0), 0);
      }
    } catch (err) {
      console.warn('Erro ao buscar despesas:', err.message);
    }

    const custoTotal = custoMateriais + custoMaoObra + custoEquipamentos + custoIndiretas;

    // ============ INDICADORES ============

    const lucroBruto = receitaFaturada - custoTotal;
    const margemPercentual = receitaFaturada > 0 ? (lucroBruto / receitaFaturada) * 100 : 0;

    // Desvio: compara custo real vs orçado
    const itensOrcamento = await base44.asServiceRole.entities.OrcamentoItem.filter({
      obra_id,
      is_grupo: false
    });

    let orcadoTotal = 0;
    const consumoVsPrevisto = {};
    const alertas = [];

    if (itensOrcamento) {
      for (const item of itensOrcamento) {
        orcadoTotal += item.valor_total || 0;

        // Comparar previsto vs realizado por item
        const consumosItem = consumos?.filter(c => {
          // Associar consumo ao item via composição
          return c.medicao_item_id ? true : false;
        }) || [];

        const realizado = consumosItem.reduce((sum, c) => sum + (c.valor_total || 0), 0);
        const desvio = item.valor_total > 0 ? ((realizado - (item.valor_total || 0)) / (item.valor_total || 0)) * 100 : 0;

        consumoVsPrevisto[item.item_num] = {
          previsto: item.valor_total || 0,
          realizado,
          desvio: parseFloat(desvio.toFixed(2))
        };

        // Alertas: consumo > previsto
        if (desvio > 10) {
          alertas.push(`Item ${item.item_num}: consumo ${desvio.toFixed(1)}% acima do previsto`);
        }
        if (desvio < -20) {
          alertas.push(`Item ${item.item_num}: consumo ${Math.abs(desvio).toFixed(1)}% abaixo do previsto`);
        }
      }
    }

    const desvioPrevistoRealizado = orcadoTotal > 0 ? ((custoTotal - orcadoTotal) / orcadoTotal) * 100 : 0;

    // Alertas adicionais
    if (margemPercentual < 5) {
      alertas.push(`⚠️ Margem baixa: ${margemPercentual.toFixed(1)}%`);
    }

    // Comparar consumo de insumos vs recebimento
    const demandas = await base44.asServiceRole.entities.DemandaEstoqueObra.filter({
      obra_id
    });

    if (demandas) {
      for (const demanda of demandas) {
        if ((demanda.quantidade_consumida || 0) > (demanda.quantidade_recebida || 0)) {
          alertas.push(`Insumo "${demanda.insumo_descricao}": consumido mais que recebido (${demanda.quantidade_consumida}>${demanda.quantidade_recebida})`);
        }
      }
    }

    // ============ SALVAR DRE ============

    const dreObra = await base44.asServiceRole.entities.DREObra.create({
      obra_id,
      periodo: 'acumulado',
      data_calculo: new Date().toISOString(),
      receita_contratada: receitaContratada,
      receita_faturada: receitaFaturada,
      receita_recebida: receitaRecebida,
      custo_materiais: custoMateriais,
      custo_mao_obra: custoMaoObra,
      custo_equipamentos: custoEquipamentos,
      custo_despesas_indiretas: custoIndiretas,
      custo_total: custoTotal,
      lucro_bruto: lucroBruto,
      margem_percentual: margemPercentual,
      desvio_previsto_realizado: desvioPrevistoRealizado,
      consumo_vs_previsto: consumoVsPrevisto,
      alertas
    });

    return Response.json({
      obra_id,
      dre_id: dreObra.id,
      receitas: {
        contratada: receitaContratada,
        faturada: receitaFaturada,
        recebida: receitaRecebida
      },
      custos: {
        materiais: custoMateriais,
        mao_obra: custoMaoObra,
        equipamentos: custoEquipamentos,
        indiretas: custoIndiretas,
        total: custoTotal
      },
      indicadores: {
        lucro_bruto: lucroBruto,
        margem_percentual: parseFloat(margemPercentual.toFixed(2)),
        desvio_percentual: parseFloat(desvioPrevistoRealizado.toFixed(2))
      },
      alertas,
      consumo_vs_previsto: consumoVsPrevisto
    });

  } catch (error) {
    console.error('Erro ao calcular DRE:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});