import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, meses_analise = 6 } = await req.json();

    // Buscar dados históricos
    const [materiais, requisicoes, ordens, orcamentos, movimentacoes] = await Promise.all([
      base44.entities.Material.list(),
      base44.entities.RequisicaoCompra.list(),
      base44.entities.OrdemCompra.list(),
      base44.entities.OrcamentoObra.filter({ obra_id }),
      base44.entities.MovimentacaoEstoque.list()
    ]);

    // Filtrar dados relevantes
    const requisicoesObra = requisicoes.filter(r => r.obra_id === obra_id);
    const ordensObra = ordens.filter(o => o.obra_id === obra_id);
    const movimentacoesObra = movimentacoes.filter(m => m.obra_id === obra_id);

    // Preparar contexto para IA
    const contexto = `
ANÁLISE DE COMPRAS E CONSUMO DE MATERIAIS

**Obra:** ${obra_id}

**Dados Históricos:**
- Total de requisições: ${requisicoesObra.length}
- Total de ordens de compra: ${ordensObra.length}
- Total de movimentações de estoque: ${movimentacoesObra.length}
- Materiais cadastrados: ${materiais.length}

**Requisições Recentes:**
${requisicoesObra.slice(-10).map(r => 
  `- ${r.titulo} (${r.status}) - Solicitado em ${r.data_solicitacao} - Valor estimado: R$ ${r.valor_total_estimado || 0}`
).join('\n')}

**Ordens de Compra Recentes:**
${ordensObra.slice(-10).map(o => 
  `- ${o.descricao} - Fornecedor: ${o.fornecedor_nome} - Valor: R$ ${o.valor_total} - Status: ${o.status}`
).join('\n')}

**Movimentações de Estoque Recentes:**
${movimentacoesObra.slice(-15).map(m => 
  `- ${m.tipo}: ${m.quantidade} ${m.unidade || 'un'} - ${m.material_id} - Data: ${m.data}`
).join('\n')}

**Orçamento da Obra:**
${orcamentos.map(orc => 
  `- Status: ${orc.status} - Valor Total: R$ ${orc.valor_total || 0}`
).join('\n')}

ANÁLISE SOLICITADA:
1. Identifique padrões de consumo de materiais
2. Preveja necessidades para os próximos ${meses_analise} meses
3. Identifique materiais críticos que podem faltar
4. Sugira melhor época para cotações baseado em:
   - Padrões de consumo
   - Prazos de entrega históricos
   - Variações de preço observadas
5. Identifique oportunidades de economia:
   - Compras em maior volume
   - Antecipação de compras
   - Materiais com preço alto
6. Identifique possíveis gargalos logísticos
7. Sugira ações prioritárias
`;

    const prompt = `${contexto}

Analise os dados acima e retorne uma análise estruturada e acionável.`;

    const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          resumo_executivo: { type: 'string' },
          padroes_consumo: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                material: { type: 'string' },
                consumo_medio_mensal: { type: 'number' },
                tendencia: { type: 'string' },
                criticidade: { type: 'string' }
              }
            }
          },
          previsao_necessidades: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                material: { type: 'string' },
                quantidade_prevista: { type: 'number' },
                mes_previsto: { type: 'string' },
                prioridade: { type: 'string' }
              }
            }
          },
          alertas_criticos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string' },
                descricao: { type: 'string' },
                severidade: { type: 'string' },
                acao_recomendada: { type: 'string' }
              }
            }
          },
          oportunidades_economia: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string' },
                descricao: { type: 'string' },
                economia_estimada: { type: 'number' },
                acao: { type: 'string' }
              }
            }
          },
          recomendacoes_cotacao: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                material: { type: 'string' },
                melhor_periodo: { type: 'string' },
                quantidade_sugerida: { type: 'number' },
                justificativa: { type: 'string' }
              }
            }
          },
          acoes_prioritarias: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                acao: { type: 'string' },
                prazo: { type: 'string' },
                impacto: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      analise: resultado,
      data_analise: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na análise de compras:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});