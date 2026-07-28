import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId } = await req.json();

    if (!obraId) {
      return Response.json({ error: 'obraId é obrigatório' }, { status: 400 });
    }

    // Buscar dados da obra
    const obra = await base44.entities.Obra.filter({ id: obraId }).then(r => r[0]);
    const orcamentos = await base44.entities.OrcamentoObra.filter({ obra_id: obraId });
    const orcamentoItens = await base44.entities.OrcamentoItem.filter({ obra_id: obraId });
    const medicoes = await base44.entities.MedicaoObra.filter({ obra_id: obraId });
    const aditivos = await base44.entities.AditivoContrato.filter({ obra_id: obraId });
    const contas = await base44.entities.ContaFinanceira.filter({ obra_id: obraId });

    // Buscar histórico de obras para análise comparativa
    const todasObras = await base44.entities.Obra.list();
    const obrasFinalizadas = todasObras
      .filter(o => o.status === 'concluida' && o.valor_orcado && o.valor_realizado)
      .slice(0, 25);

    // Calcular métricas de desvio histórico
    const desvios = obrasFinalizadas.map(o => ({
      percentual: ((o.valor_realizado - o.valor_orcado) / o.valor_orcado) * 100,
      valor_orcado: o.valor_orcado,
      valor_realizado: o.valor_realizado
    }));

    const desvioMedio = desvios.length > 0 
      ? desvios.reduce((a, b) => a + b.percentual, 0) / desvios.length 
      : 0;

    const desvioMaximo = desvios.length > 0 
      ? Math.max(...desvios.map(d => d.percentual))
      : 0;

    // Calcular progresso e tendências
    const diasDecorridos = obra.data_inicio 
      ? Math.ceil((new Date() - new Date(obra.data_inicio)) / (1000 * 60 * 60 * 24))
      : 0;
    const diasTotais = obra.data_inicio && obra.data_prevista_fim
      ? Math.ceil((new Date(obra.data_prevista_fim) - new Date(obra.data_inicio)) / (1000 * 60 * 60 * 24))
      : 1;

    const percentualProgresso = Math.min((diasDecorridos / diasTotais) * 100, 100);
    const valorGastoAteAgora = contas
      .filter(c => c.status === 'pago' || c.status === 'atrasado')
      .reduce((sum, c) => sum + (c.valor || 0), 0);

    const velocidadeSemanal = valorGastoAteAgora / (diasDecorridos / 7 || 1);

    // Preparar dados para IA
    const prompt = `Você é um especialista em análise financeira de projetos de construção. Analise os dados abaixo e forneça previsão de custos finais e otimizações.

OBRA ATUAL:
- Nome: ${obra?.nome}
- Status: ${obra?.status}
- Valor Orçado: R$ ${obra?.valor_orcado?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) || 0}
- Valor Realizado até Agora: R$ ${obra?.valor_realizado?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) || 0}
- Valor Gasto (Contas Pagas): R$ ${valorGastoAteAgora?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) || 0}
- Percentual Concluído: ${obra?.percentual_concluido || 0}%

PROGRESSO E TENDÊNCIAS:
- Dias Decorridos: ${diasDecorridos}
- Dias Totais Planejados: ${diasTotais}
- Percentual do Prazo: ${percentualProgresso.toFixed(1)}%
- Velocidade Semanal de Gasto: R$ ${velocidadeSemanal?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) || 0}
- Itens Orçados: ${orcamentoItens?.length || 0}
- Medições Realizadas: ${medicoes?.length || 0}
- Aditivos: ${aditivos?.length || 0}

HISTÓRICO COMPARATIVO (últimas ${obrasFinalizadas.length} obras):
- Desvio Médio: ${desvioMedio.toFixed(1)}%
- Desvio Máximo: ${desvioMaximo.toFixed(1)}%
- Número de Obras Analisadas: ${obrasFinalizadas.length}

FORNEÇA UMA ANÁLISE EM JSON COM:
1. previsao_custo_final: valor estimado final (número)
2. desvio_percentual_previsto: percentual de desvio em relação ao orçado
3. confianca_predicao: 1-100 (quanto maior, mais confiável)
4. risco_estouramento: 1-10
5. pontos_criticos: array com áreas de maior risco
6. otimizacoes_financeiras: array de otimizações sugeridas
7. acompanhamento_recomendado: array com KPIs a monitorar
8. alertas: array com alertas imediatos

Retorne APENAS JSON válido, sem markdown.`;

    const predicaoIA = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          previsao_custo_final: { type: 'number' },
          desvio_percentual_previsto: { type: 'number' },
          confianca_predicao: { type: 'number' },
          risco_estouramento: { type: 'number' },
          pontos_criticos: { type: 'array', items: { type: 'string' } },
          otimizacoes_financeiras: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string' },
                descricao: { type: 'string' },
                economia_potencial: { type: 'string' }
              }
            }
          },
          acompanhamento_recomendado: { type: 'array', items: { type: 'string' } },
          alertas: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Salvar previsão na obra
    await base44.entities.Obra.update(obraId, {
      previsao_custo_final_ia: predicaoIA,
      data_ultima_predicao_custos: new Date().toISOString()
    });

    return Response.json({
      predicao: predicaoIA,
      metricas_atuais: {
        valor_orcado: obra?.valor_orcado,
        valor_realizado: obra?.valor_realizado,
        valor_gasto: valorGastoAteAgora,
        percentual_concluido: obra?.percentual_concluido,
        velocidade_semanal: velocidadeSemanal,
        desvio_historico_medio: desvioMedio,
        confianca_modelo: Math.max(50, Math.min(95, 70 + (obrasFinalizadas.length * 2)))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});