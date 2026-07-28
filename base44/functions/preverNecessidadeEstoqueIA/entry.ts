import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar dados de materiais e movimentações
    const materiais = await base44.asServiceRole.entities.Material.list('-created_date', 500);
    const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.list('-data_movimentacao', 1000);

    // Agrupar movimentações por material
    const movimentacoesPorMaterial = {};
    for (const mov of movimentacoes) {
      if (!mov.material_id) continue;
      if (!movimentacoesPorMaterial[mov.material_id]) {
        movimentacoesPorMaterial[mov.material_id] = [];
      }
      movimentacoesPorMaterial[mov.material_id].push(mov);
    }

    // Preparar dados para análise
    const dadosAnalise = materiais.slice(0, 20).map(material => {
      const movs = movimentacoesPorMaterial[material.id] || [];
      const saidas = movs.filter(m => m.tipo === 'saida');
      const entradas = movs.filter(m => m.tipo === 'entrada');

      return {
        id: material.id,
        nome: material.nome,
        codigo: material.codigo,
        categoria: material.categoria,
        estoque_atual: material.estoque_atual || 0,
        estoque_minimo: material.estoque_minimo || 0,
        preco_medio: material.preco_medio || 0,
        total_movimentacoes: movs.length,
        total_saidas: saidas.length,
        total_entradas: entradas.length,
        quantidade_saidas_ultimos_30d: saidas.filter(s => {
          const dias = (Date.now() - new Date(s.data_movimentacao).getTime()) / (1000 * 60 * 60 * 24);
          return dias <= 30;
        }).reduce((sum, s) => sum + (s.quantidade || 0), 0)
      };
    });

    const prompt = `Você é um especialista em gestão de estoque para construção civil.

Analise os seguintes materiais e seus padrões de consumo:

${JSON.stringify(dadosAnalise, null, 2)}

Para cada material, forneça uma análise detalhada considerando:
1. Consumo médio diário/semanal baseado em saídas recentes
2. Tempo estimado até o estoque zerar (dias)
3. Ponto de reposição ideal
4. Quantidade sugerida para pedido
5. Nível de urgência (baixa, média, alta, crítica)
6. Sazonalidade ou padrões identificados
7. Risco de ruptura de estoque

Retorne um JSON com o seguinte formato:
{
  "previsoes": [
    {
      "material_id": "id",
      "material_nome": "nome",
      "consumo_medio_diario": 0,
      "dias_ate_ruptura": 0,
      "ponto_reposicao_sugerido": 0,
      "quantidade_pedido_sugerida": 0,
      "urgencia": "baixa|media|alta|critica",
      "justificativa": "explicação detalhada",
      "acoes_recomendadas": ["ação 1", "ação 2"]
    }
  ],
  "alertas_gerais": [
    {
      "tipo": "ruptura_iminente|estoque_excessivo|oportunidade_compra",
      "mensagem": "descrição do alerta",
      "materiais_afetados": ["material1", "material2"]
    }
  ],
  "insights": [
    "insight sobre padrões de consumo",
    "insight sobre sazonalidade",
    "insight sobre otimização"
  ]
}`;

    const analise = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          previsoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                material_id: { type: "string" },
                material_nome: { type: "string" },
                consumo_medio_diario: { type: "number" },
                dias_ate_ruptura: { type: "number" },
                ponto_reposicao_sugerido: { type: "number" },
                quantidade_pedido_sugerida: { type: "number" },
                urgencia: { type: "string" },
                justificativa: { type: "string" },
                acoes_recomendadas: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          },
          alertas_gerais: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tipo: { type: "string" },
                mensagem: { type: "string" },
                materiais_afetados: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          },
          insights: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    return Response.json({
      sucesso: true,
      data_analise: new Date().toISOString(),
      materiais_analisados: dadosAnalise.length,
      ...analise
    });

  } catch (error) {
    console.error('Erro ao prever necessidades:', error);
    return Response.json({ 
      error: 'Erro ao processar previsão: ' + error.message 
    }, { status: 500 });
  }
});