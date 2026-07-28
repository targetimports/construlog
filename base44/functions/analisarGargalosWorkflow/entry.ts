import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todas as instâncias de workflow
    const instancias = await base44.entities.WorkflowInstancia.list('-created_date', 200);
    const workflows = await base44.entities.Workflow.list();

    // Calcular métricas por workflow
    const metricas = workflows.map(wf => {
      const instanciasWf = instancias.filter(i => i.workflow_id === wf.id);
      
      const temposMedios = instanciasWf
        .filter(i => i.data_inicio && i.data_conclusao)
        .map(i => {
          const inicio = new Date(i.data_inicio);
          const fim = new Date(i.data_conclusao);
          return Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24));
        });

      const tempoMedio = temposMedios.length > 0
        ? temposMedios.reduce((a, b) => a + b, 0) / temposMedios.length
        : 0;

      const taxaAprovacao = instanciasWf.length > 0
        ? (instanciasWf.filter(i => i.status === 'aprovado').length / instanciasWf.length) * 100
        : 0;

      const emAndamento = instanciasWf.filter(i => i.status === 'em_andamento').length;

      return {
        workflow_id: wf.id,
        workflow_nome: wf.nome,
        tipo: wf.tipo_entidade,
        total_instancias: instanciasWf.length,
        tempo_medio_dias: Math.round(tempoMedio),
        taxa_aprovacao: Math.round(taxaAprovacao),
        em_andamento: emAndamento,
        instancias_recentes: instanciasWf.slice(0, 5).map(i => ({
          status: i.status,
          etapa_atual: i.etapa_atual,
          dias_em_andamento: i.data_inicio 
            ? Math.ceil((new Date() - new Date(i.data_inicio)) / (1000 * 60 * 60 * 24))
            : 0
        }))
      };
    });

    const prompt = `
Você é um especialista em otimização de processos para empresas de construção.

Analise as métricas dos workflows abaixo e identifique:
1. Gargalos (workflows lentos, com baixa taxa de aprovação)
2. Padrões problemáticos
3. Sugestões específicas de otimização para cada workflow com problema

Métricas dos workflows:
${JSON.stringify(metricas, null, 2)}

Retorne APENAS JSON válido com análise detalhada.
`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          gargalos_identificados: {
            type: "array",
            items: {
              type: "object",
              properties: {
                workflow_nome: { type: "string" },
                problema: { type: "string" },
                severidade: { type: "string", enum: ["critica", "alta", "media", "baixa"] },
                impacto: { type: "string" }
              }
            }
          },
          otimizacoes_sugeridas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                workflow_nome: { type: "string" },
                sugestao: { type: "string" },
                beneficio_esperado: { type: "string" },
                dificuldade: { type: "string", enum: ["baixa", "media", "alta"] }
              }
            }
          },
          resumo_geral: { type: "string" }
        }
      }
    });

    return Response.json({ 
      success: true, 
      analise: resultado,
      metricas
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});