import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, tipo_relatorio } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // Buscar dados base
    const medicoes = await base44.entities.Medicao.filter({ obra_id, status: 'processada' });
    const itensOrcamento = await base44.entities.OrcamentoItem.filter({ obra_id });
    const consumos = await base44.entities.ConsumoEstoqueObra.filter({ obra_id });
    const usos = await base44.entities.RegistroUsoEquipamento.filter({ obra_id });

    let relatorio = {};

    // 1️⃣ MEDIÇÃO POR OBRA
    if (tipo_relatorio === 'medicao' || !tipo_relatorio) {
      relatorio.medicao = medicoes.map(med => {
        const item = itensOrcamento.find(i => i.id === med.item_orcamento_id);
        return {
          data: med.data_medicao,
          descricao_item: item?.descricao,
          quantidade_medida: med.quantidade,
          unidade: item?.unidade,
          custo_real: med.custo_total_realizado,
          horas_maquina: med.horas_maquina,
          responsavel: med.responsavel_email,
          status: med.status
        };
      });
    }

    // 2️⃣ CONSUMO REAL
    if (tipo_relatorio === 'consumo' || !tipo_relatorio) {
      const consumoAgrupado = {};
      consumos.forEach(c => {
        const chave = c.insumo_descricao;
        if (!consumoAgrupado[chave]) {
          consumoAgrupado[chave] = {
            insumo: chave,
            tipo: c.tipo_insumo,
            quantidade_total: 0,
            unidade: c.unidade,
            custo_total: 0,
            preco_medio: 0
          };
        }
        consumoAgrupado[chave].quantidade_total += c.quantidade_consumida;
        consumoAgrupado[chave].custo_total += c.custo_total;
      });

      relatorio.consumo = Object.values(consumoAgrupado).map(c => ({
        ...c,
        preco_medio: c.quantidade_total > 0 ? c.custo_total / c.quantidade_total : 0
      }));
    }

    // 3️⃣ USO DE EQUIPAMENTOS
    if (tipo_relatorio === 'equipamentos' || !tipo_relatorio) {
      const equipAgrupado = {};
      usos.forEach(u => {
        const chave = u.equipamento_id;
        if (!equipAgrupado[chave]) {
          equipAgrupado[chave] = {
            equipamento_id: u.equipamento_id,
            horas_total: 0,
            custo_total: 0,
            utilizacoes: 0
          };
        }
        equipAgrupado[chave].horas_total += u.horas_trabalhadas;
        equipAgrupado[chave].custo_total += u.custo_total;
        equipAgrupado[chave].utilizacoes += 1;
      });

      relatorio.equipamentos = Object.values(equipAgrupado).map(e => ({
        ...e,
        custo_medio_hora: e.horas_total > 0 ? e.custo_total / e.horas_total : 0
      }));
    }

    // 4️⃣ DESVIO ORÇAMENTÁRIO
    if (tipo_relatorio === 'desvio' || !tipo_relatorio) {
      relatorio.desvios = itensOrcamento.map(item => {
        const consumoItem = consumos
          .filter(c => c.item_orcamento_id === item.id)
          .reduce((sum, c) => sum + c.custo_total, 0);

        const custoPrevistoItem = (item.quantidade_prevista || 0) * (item.valor_unitario || 0);
        const desvio = consumoItem - custoPrevistoItem;
        const percentualDesvio = custoPrevistoItem > 0 ? (desvio / custoPrevistoItem) * 100 : 0;

        return {
          descricao: item.descricao,
          quantidade_prevista: item.quantidade_prevista,
          quantidade_executada: item.quantidade_executada || 0,
          custo_previsto: custoPrevistoItem,
          custo_realizado: consumoItem,
          desvio: desvio,
          percentual_desvio: percentualDesvio,
          status: percentualDesvio > 10 ? 'alerta' : percentualDesvio < -10 ? 'favoravel' : 'dentro'
        };
      });

      // Resumo geral
      const custoOrcadoTotal = itensOrcamento.reduce((sum, i) => sum + ((i.quantidade_prevista || 0) * (i.valor_unitario || 0)), 0);
      const custoRealizadoTotal = consumos.reduce((sum, c) => sum + c.custo_total, 0);
      relatorio.resumo = {
        custo_orcado_total: custoOrcadoTotal,
        custo_realizado_total: custoRealizadoTotal,
        desvio_total: custoRealizadoTotal - custoOrcadoTotal,
        percentual_execucao: custoOrcadoTotal > 0 ? (custoRealizadoTotal / custoOrcadoTotal) * 100 : 0
      };
    }

    return Response.json({
      sucesso: true,
      tipo_relatorio: tipo_relatorio || 'completo',
      data_geracao: new Date().toISOString(),
      relatorio
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});