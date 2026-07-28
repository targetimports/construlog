import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId } = await req.json();

    const obra = await base44.entities.Obra.read(obraId);
    const contas = await base44.entities.ContaFinanceira.filter({ obra_id: obraId });
    const medicoes = await base44.entities.Medicao.filter({ obra_id: obraId });
    const diarios = await base44.entities.DiarioObra.filter({ obra_id: obraId });

    // Calcula métricas
    const custoAtual = contas.filter(c => c.tipo === 'pagar' && c.status === 'pago').reduce((a, c) => a + (c.valor || 0), 0);
    const custoProjetado = contas.filter(c => c.tipo === 'pagar').reduce((a, c) => a + (c.valor || 0), 0);
    const receitaAtual = contas.filter(c => c.tipo === 'receber' && c.status === 'pago').reduce((a, c) => a + (c.valor || 0), 0);
    const receitaProjetada = contas.filter(c => c.tipo === 'receber').reduce((a, c) => a + (c.valor || 0), 0);
    
    const margem = receitaAtual > 0 ? ((receitaAtual - custoAtual) / receitaAtual * 100) : 0;
    const margemProjetada = receitaProjetada > 0 ? ((receitaProjetada - custoProjetado) / receitaProjetada * 100) : 0;

    // Agrupa despesas por categoria
    const despesasPorCategoria = {};
    contas.filter(c => c.tipo === 'pagar').forEach(c => {
      const cat = c.categoria || 'outros';
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + (c.valor || 0);
    });

    // Dados para análise
    const resumoObra = `
OBRA: ${obra.nome}
Período: ${obra.data_inicio} a ${obra.data_fim_real || 'em andamento'}
Status: ${obra.status}

FINANCEIRO:
- Valor contrato: R$ ${obra.valor_contrato?.toFixed(2) || 0}
- Valor orçado: R$ ${obra.valor_orcado?.toFixed(2) || 0}
- Custo atual (pago): R$ ${custoAtual.toFixed(2)}
- Custo projetado: R$ ${custoProjetado.toFixed(2)}
- Receita atual: R$ ${receitaAtual.toFixed(2)}
- Margem atual: ${margem.toFixed(2)}%
- Margem projetada: ${margemProjetada.toFixed(2)}%
- Progresso físico: ${obra.percentual_concluido || 0}%

DESPESAS POR CATEGORIA:
${Object.entries(despesasPorCategoria).map(([cat, val]) => `- ${cat}: R$ ${val.toFixed(2)}`).join('\n')}

ATIVIDADES REGISTRADAS: ${diarios.length}
MEDIÇÕES: ${medicoes.length}
`;

    const prompt = `Você é um analista especializado em gestão de projetos de construção civil.

${resumoObra}

Baseado nesses dados, forneça uma análise completa da obra incluindo:

1. KPIS CRÍTICOS: Resumo dos principais indicadores de desempenho
2. ANÁLISE DE CUSTOS: Identificar categorias de alto custo e ineficiências
3. RISCOS FINANCEIROS: 3-5 riscos específicos desta obra
4. OPORTUNIDADES: 3-5 oportunidades de economia ou otimização
5. OTIMIZAÇÃO DE RECURSOS: Estratégias práticas para reduzir custos
6. RECOMENDAÇÕES IMEDIATAS: Ações para implementar nos próximos 30 dias

Forneça resposta em JSON com chaves: kpis (string), analise_custos (string), riscos (array), oportunidades (array), otimizacao_recursos (array), recomendacoes (array).`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          kpis: { type: 'string' },
          analise_custos: { type: 'string' },
          riscos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                risco: { type: 'string' },
                impacto: { type: 'string' },
                mitigacao: { type: 'string' }
              }
            }
          },
          oportunidades: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                oportunidade: { type: 'string' },
                economia: { type: 'string' },
                implementacao: { type: 'string' }
              }
            }
          },
          otimizacao_recursos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                area: { type: 'string' },
                sugestao: { type: 'string' },
                beneficio: { type: 'string' }
              }
            }
          },
          recomendacoes: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    return Response.json({
      success: true,
      obra: {
        id: obra.id,
        nome: obra.nome,
        status: obra.status
      },
      metricas: {
        custoAtual,
        custoProjetado,
        receitaAtual,
        receitaProjetada,
        margem,
        margemProjetada,
        progressoFisico: obra.percentual_concluido || 0
      },
      despesasPorCategoria,
      analise: resultado
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});