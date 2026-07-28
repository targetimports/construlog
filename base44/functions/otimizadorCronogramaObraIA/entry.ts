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

    // Buscar dados da obra e histórico
    const obra = await base44.entities.Obra.filter({ id: obraId }).then(r => r[0]);
    const orcamentos = await base44.entities.OrcamentoObra.filter({ obra_id: obraId });
    const orcamentoItens = await base44.entities.OrcamentoItem.filter({ obra_id: obraId });
    const medicoes = await base44.entities.MedicaoObra.filter({ obra_id: obraId });
    const diarios = await base44.entities.DiarioObra.filter({ obra_id: obraId });

    // Buscar todas as obras para análise histórica
    const todasObras = await base44.entities.Obra.list();
    const obrasHistoricas = todasObras.filter(
      o => o.data_fim_real && o.data_prevista_fim && o.status === 'concluida'
    ).slice(0, 20);

    // Preparar dados para IA
    const prompt = `Você é um especialista em gestão de projetos de construção civil. Analise os seguintes dados e forneça previsões e otimizações de cronograma.

OBRA ATUAL:
- Nome: ${obra?.nome}
- Data Início: ${obra?.data_inicio}
- Data Prevista Fim: ${obra?.data_prevista_fim}
- Status: ${obra?.status}
- Percentual Concluído: ${obra?.percentual_concluido}%
- Valor Orcado: R$ ${obra?.valor_orcado}
- Valor Realizado: R$ ${obra?.valor_realizado}

PROGRESSO FÍSICO:
- Total de Itens: ${orcamentoItens?.length || 0}
- Medições Realizadas: ${medicoes?.length || 0}
- Dias de Diário: ${diarios?.length || 0}

DADOS HISTÓRICOS (últimas ${obrasHistoricas.length} obras concluídas):
${obrasHistoricas.map(o => {
  const diasPrevisto = Math.ceil((new Date(o.data_prevista_fim) - new Date(o.data_inicio)) / (1000 * 60 * 60 * 24));
  const diasReal = Math.ceil((new Date(o.data_fim_real) - new Date(o.data_inicio)) / (1000 * 60 * 60 * 24));
  const atraso = diasReal - diasPrevisto;
  return `  - ${o.nome}: ${diasPrevisto} dias planejado, ${diasReal} dias real (${atraso > 0 ? '+' : ''}${atraso} dias)`;
}).join('\n')}

FORNEÇA UMA ANÁLISE EM JSON COM:
1. previsao_conclusao: data estimada de conclusão (YYYY-MM-DD)
2. dias_atraso_previsto: número de dias de atraso esperado
3. risco_atraso: número de 1-10
4. gargalos_identificados: array com gargalos críticos
5. otimizacoes: array de otimizações sugeridas (paralelismo, recursos, priorização)
6. recursos_necessarios: objeto com recursos críticos recomendados
7. metricas_comparativas: como esta obra se compara ao histórico
8. plano_acao: array de ações prioritárias

Retorne APENAS JSON válido, sem markdown.`;

    const analiseIA = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          previsao_conclusao: { type: 'string' },
          dias_atraso_previsto: { type: 'number' },
          risco_atraso: { type: 'number' },
          gargalos_identificados: {
            type: 'array',
            items: { type: 'string' }
          },
          otimizacoes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string' },
                descricao: { type: 'string' },
                impacto: { type: 'string' }
              }
            }
          },
          recursos_necessarios: { type: 'object' },
          metricas_comparativas: {
            type: 'object',
            properties: {
              tempo_medio_historico: { type: 'string' },
              comparacao: { type: 'string' }
            }
          },
          plano_acao: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    // Salvar análise na obra
    await base44.entities.Obra.update(obraId, {
      otimizacao_cronograma_ia: analiseIA,
      data_ultima_otimizacao: new Date().toISOString()
    });

    return Response.json({
      analise: analiseIA,
      timestamp: new Date().toISOString(),
      obrasAnalisadas: obrasHistoricas.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});