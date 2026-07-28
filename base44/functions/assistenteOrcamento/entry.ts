import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, descricao, briefCompleto } = await req.json();

    const obra = await base44.entities.Obra.filter({ id: obraId });
    
    if (!obra.length) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    const prompt = `
    Você é um especialista em orçamentação de obras civis. 
    Crie um orçamento detalhado para a seguinte obra:
    
    Nome: ${obra[0].nome}
    Cliente: ${obra[0].cliente}
    Tipo: ${obra[0].tipo_obra}
    Área: ${obra[0].area_total} m²
    Descrição: ${descricao}
    
    ${briefCompleto ? 'Informações Detalhadas: ' + briefCompleto : ''}
    
    Gere um orçamento estruturado em etapas (Fundação, Estrutura, Vedação, Cobertura, Acabamento, Instalações, Serviços).
    
    Para cada etapa, inclua:
    - Código de identificação
    - Descrição detalhada
    - Quantidade
    - Unidade
    - Valor unitário estimado
    - Categoria (materiais, mão de obra, equipamentos, serviços, transporte)
    
    Retorne em formato JSON com um array de items.
    `;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                etapa: { type: 'string' },
                codigo: { type: 'string' },
                descricao: { type: 'string' },
                quantidade: { type: 'number' },
                unidade: { type: 'string' },
                valor_unitario: { type: 'number' },
                categoria: { type: 'string' }
              }
            }
          },
          resumo: { type: 'string' }
        }
      }
    });

    if (!response.items || response.items.length === 0) {
      return Response.json({ error: 'Falha ao gerar orçamento' }, { status: 500 });
    }

    return Response.json({ 
      success: true,
      items: response.items,
      resumo: response.resumo,
      totalEstimado: response.items.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});