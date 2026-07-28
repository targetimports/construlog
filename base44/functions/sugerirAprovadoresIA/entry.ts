import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tipo_entidade, valor, obra_id, historico_workflows } = await req.json();

    // Buscar instâncias passadas similares
    const instancias = await base44.entities.WorkflowInstancia.list('-created_date', 50);
    const workflows = await base44.entities.Workflow.list();

    // Preparar contexto para IA
    const contextoHistorico = instancias
      .filter(i => i.entidade === tipo_entidade && i.status === 'aprovado')
      .slice(0, 10)
      .map(i => {
        const wf = workflows.find(w => w.id === i.workflow_id);
        return {
          workflow: wf?.nome,
          etapas_usadas: i.historico_aprovacoes?.length || 0,
          aprovadores: i.historico_aprovacoes?.map(h => h.aprovador) || [],
          tempo_conclusao: i.data_conclusao && i.data_inicio 
            ? Math.ceil((new Date(i.data_conclusao) - new Date(i.data_inicio)) / (1000 * 60 * 60 * 24))
            : null
        };
      });

    const prompt = `
Você é um assistente de IA especializado em otimização de workflows para empresas de construção.

Contexto:
- Tipo de solicitação: ${tipo_entidade}
- Valor envolvido: ${valor ? `R$ ${valor.toLocaleString('pt-BR')}` : 'Não informado'}
- Obra: ${obra_id || 'Geral'}

Histórico de workflows similares aprovados:
${JSON.stringify(contextoHistorico, null, 2)}

Com base no histórico, sugira:
1. Quais aprovadores devem estar no workflow (máximo 3 níveis)
2. Prazo recomendado para cada etapa
3. Justificativa da sugestão

Retorne APENAS JSON válido, sem markdown.
`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          aprovadores_sugeridos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nivel: { type: "number" },
                cargo: { type: "string" },
                prazo_dias: { type: "number" }
              }
            }
          },
          justificativa: { type: "string" },
          confianca: { type: "string", enum: ["alta", "media", "baixa"] }
        }
      }
    });

    return Response.json({ 
      success: true, 
      sugestoes: resultado 
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});