import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, itemOrcamentoId } = await req.json();

    // Buscar histórico de obras similares
    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId });
    const item = await base44.entities.ItemOrcamento.filter({ id: itemOrcamentoId });
    const obra = await base44.entities.Obra.filter({ id: orcamento[0].obra_id });

    // Buscar obras similares finalizadas
    const obrasHistorico = await base44.entities.Obra.filter({ 
      tipo_obra: obra[0].tipo_obra,
      status: 'concluida'
    }, '-data_fim_real', 10);

    // Análise de desvios históricos
    const desvios = [];
    for (const obraHist of obrasHistorico) {
      const medicoes = await base44.entities.Medicao.filter({ obra_id: obraHist.id });
      const itemsHist = await base44.entities.ItemOrcamento.filter({ orcamento_id: obraHist.id });
      
      const totalOrcado = itemsHist.reduce((acc, i) => acc + (i.valor_total || 0), 0);
      const totalRealizado = medicoes.reduce((acc, m) => acc + (m.valor_medido || 0), 0);
      const percentualDesvio = totalOrcado > 0 ? ((totalRealizado - totalOrcado) / totalOrcado) * 100 : 0;
      
      desvios.push({
        obra_id: obraHist.id,
        percentual_desvio: percentualDesvio,
        tipo_obra: obraHist.tipo_obra,
        area: obraHist.area_total
      });
    }

    // Calcular média de desvio e desvio padrão
    const mediaDesvio = desvios.length > 0 
      ? desvios.reduce((acc, d) => acc + d.percentual_desvio, 0) / desvios.length 
      : 0;

    const variancia = desvios.length > 0
      ? desvios.reduce((acc, d) => acc + Math.pow(d.percentual_desvio - mediaDesvio, 2), 0) / desvios.length
      : 0;

    const desvPadrao = Math.sqrt(variancia);

    // Predição para item atual
    const predicao = {
      valor_orcado: item[0].valor_total || 0,
      media_desvio_historico: mediaDesvio,
      desvio_padrao: desvPadrao,
      intervalo_confianca_95: {
        minimo: item[0].valor_total * (1 + (mediaDesvio - 1.96 * desvPadrao) / 100),
        maximo: item[0].valor_total * (1 + (mediaDesvio + 1.96 * desvPadrao) / 100)
      },
      valor_provavel: item[0].valor_total * (1 + mediaDesvio / 100),
      risco_sobre_orcado: mediaDesvio < 0 ? 'baixo' : mediaDesvio > 10 ? 'alto' : 'medio',
      obras_analisadas: desvios.length
    };

    return Response.json({ success: true, predicao, historicoDesvios: desvios });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});