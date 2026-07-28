import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, dataInicio, duracao } = await req.json();

    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId });
    const items = await base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId });

    if (!orcamento.length || !items.length) {
      return Response.json({ error: 'Orçamento ou itens não encontrados' }, { status: 404 });
    }

    // Ordenar itens e calcular cronograma
    const start = new Date(dataInicio);
    const totalDias = duracao || 90;
    const itemsPerDay = items.length / totalDias;
    
    const updatedItems = items.map((item, index) => {
      const diaInicio = Math.floor(index / itemsPerDay);
      const duracao_dias = Math.ceil(1 / (items.length / totalDias));
      
      const data_inicio = new Date(start);
      data_inicio.setDate(data_inicio.getDate() + diaInicio);
      
      const data_fim = new Date(data_inicio);
      data_fim.setDate(data_fim.getDate() + duracao_dias);

      return {
        ...item,
        data_inicio: data_inicio.toISOString().split('T')[0],
        data_fim: data_fim.toISOString().split('T')[0],
        duracao_dias: duracao_dias,
        mes_previsto: data_inicio.getMonth() + 1
      };
    });

    // Atualizar itens com cronograma
    for (const item of updatedItems) {
      await base44.entities.ItemOrcamento.update(item.id, {
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        duracao_dias: item.duracao_dias,
        mes_previsto: item.mes_previsto
      });
    }

    // Calcular CFF por mês
    const cffPorMes = {};
    for (let mes = 1; mes <= 12; mes++) {
      const itemsDoMes = updatedItems.filter(item => item.mes_previsto === mes);
      const valorDoMes = itemsDoMes.reduce((acc, item) => acc + (item.valor_total || 0), 0);
      const percentualDoMes = (valorDoMes / (orcamento[0].valor_orcado || 1)) * 100;
      
      cffPorMes[mes] = {
        mes,
        valor_planejado: valorDoMes,
        percentual_planejado: percentualDoMes.toFixed(2),
        valor_realizado: 0,
        percentual_realizado: 0
      };
    }

    return Response.json({
      success: true,
      itemsUpdated: updatedItems.length,
      cffPorMes,
      items: updatedItems
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});