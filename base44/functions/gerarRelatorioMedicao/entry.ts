import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, tipo_relatorio } = await req.json();
    if (!obra_id) return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });

    const medicoes = await base44.entities.Medicao.filter({ obra_id });
    const itens = await base44.entities.OrcamentoItem.filter({ obra_id });

    if (tipo_relatorio === 'medicao') {
      // Relatório de Medições
      const dados = medicoes.map(m => {
        const item = itens.find(i => i.id === m.orcamento_item_id);
        return {
          data: m.data_medicao,
          item: item?.descricao,
          quantidade: m.quantidade_medida,
          unidade: item?.unidade,
          custo_material: m.custo_material || 0,
          custo_mao_obra: m.custo_mao_obra || 0,
          custo_equipamento: m.custo_equipamento || 0,
          custo_total: m.custo_total || 0,
          responsavel: m.responsavel
        };
      });
      return Response.json({ status: 'sucesso', dados });
    }

    if (tipo_relatorio === 'consumo') {
      // Relatório de Consumo Real por Insumo
      const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({ 
        obra_destino_id: obra_id 
      });
      
      const consumoPorInsumo = {};
      for (const mov of movimentacoes) {
        if (!consumoPorInsumo[mov.insumo_id]) {
          consumoPorInsumo[mov.insumo_id] = {
            quantidade: 0,
            valor_total: 0
          };
        }
        consumoPorInsumo[mov.insumo_id].quantidade += mov.quantidade;
        consumoPorInsumo[mov.insumo_id].valor_total += mov.valor_total || 0;
      }

      const dados = Object.entries(consumoPorInsumo).map(([insumo_id, dados]) => ({
        insumo_id,
        quantidade_consumida: dados.quantidade,
        valor_total: dados.valor_total,
        custo_medio: dados.quantidade > 0 ? dados.valor_total / dados.quantidade : 0
      }));

      return Response.json({ status: 'sucesso', dados });
    }

    if (tipo_relatorio === 'equipamento') {
      // Relatório de Uso de Equipamentos
      const usos = await base44.entities.RegistroUsoEquipamento.filter({ obra_id });
      
      const dados = usos.map(u => ({
        equipamento_id: u.equipamento_id,
        data_inicio: u.data_inicio,
        horas_utilizadas: u.horas_trabalhadas,
        custo_total: u.custo_total || 0
      }));

      return Response.json({ status: 'sucesso', dados });
    }

    if (tipo_relatorio === 'desvio') {
      // Relatório de Desvio Orçamentário
      const dados = itens.map(item => {
        const custo_previsto = (item.quantidade || 0) * (item.valor_unitario || 0);
        const custo_realizado = item.custo_realizado || 0;
        const desvio = custo_previsto > 0 ? ((custo_realizado - custo_previsto) / custo_previsto * 100).toFixed(2) : 0;
        
        return {
          item: item.descricao,
          quantidade_prevista: item.quantidade,
          quantidade_executada: item.quantidade_executada || 0,
          custo_previsto,
          custo_realizado,
          desvio_percentual: parseFloat(desvio),
          diferenca: custo_realizado - custo_previsto
        };
      });

      return Response.json({ status: 'sucesso', dados });
    }

    return Response.json({ error: 'Tipo de relatório inválido' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});