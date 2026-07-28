import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, limiteDesvio = 5 } = await req.json();

    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId });
    const items = await base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId });
    const medicoes = await base44.entities.Medicao.filter({ obra_id: orcamento[0].obra_id });

    const alertas = [];

    // Análise por item
    for (const item of items) {
      const medicoesDoBem = medicoes.filter(m => m.itens?.some(i => i.item_id === item.id));
      const totalMedido = medicoesDoBem.reduce((acc, m) => acc + (m.valor_medido || 0), 0);
      
      const desvio = item.valor_total > 0 ? ((totalMedido - item.valor_total) / item.valor_total) * 100 : 0;

      // Alerta de sobre-orçado
      if (desvio > limiteDesvio) {
        alertas.push({
          tipo_alerta: 'sobre_orcado',
          severidade: desvio > 20 ? 'critica' : 'alta',
          percentual_desvio: desvio,
          descricao: `Item "${item.descricao}" com desvio de ${desvio.toFixed(2)}% do orçado`,
          item_orcamento_id: item.id,
          valor_orcado: item.valor_total,
          valor_realizado: totalMedido,
          obra_id: orcamento[0].obra_id,
          orcamento_id: orcamentoId
        });
      }

      // Alerta de margem baixa
      const margem = ((item.valor_total - totalMedido) / item.valor_total) * 100;
      if (margem < 10 && margem > 0) {
        alertas.push({
          tipo_alerta: 'margem_baixa',
          severidade: margem < 5 ? 'alta' : 'media',
          percentual_desvio: 100 - margem,
          descricao: `Margem crítica em "${item.descricao}": apenas ${margem.toFixed(2)}% restante`,
          item_orcamento_id: item.id,
          valor_orcado: item.valor_total,
          valor_realizado: totalMedido,
          obra_id: orcamento[0].obra_id,
          orcamento_id: orcamentoId
        });
      }
    }

    // Alerta geral de desvio de custo
    const totalOrcado = items.reduce((acc, i) => acc + (i.valor_total || 0), 0);
    const totalRealizado = medicoes.reduce((acc, m) => acc + (m.valor_medido || 0), 0);
    const desvioGeral = totalOrcado > 0 ? ((totalRealizado - totalOrcado) / totalOrcado) * 100 : 0;

    if (Math.abs(desvioGeral) > limiteDesvio) {
      alertas.push({
        tipo_alerta: 'desvio_custo',
        severidade: Math.abs(desvioGeral) > 20 ? 'critica' : 'alta',
        percentual_desvio: desvioGeral,
        descricao: `Desvio geral do orçamento: ${desvioGeral.toFixed(2)}%`,
        valor_orcado: totalOrcado,
        valor_realizado: totalRealizado,
        obra_id: orcamento[0].obra_id,
        orcamento_id: orcamentoId
      });
    }

    // Criar alertas no banco de dados
    for (const alerta of alertas) {
      await base44.entities.AlertaDesvio.create(alerta);
    }

    return Response.json({ 
      success: true, 
      alertasCriados: alertas.length,
      alertas 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});