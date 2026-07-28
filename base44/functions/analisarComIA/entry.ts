import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tipo, dados } = await req.json();

    let prompt = '';
    if (tipo === 'custos') {
      prompt = `Analise esses dados de custos e sugira otimizações: ${JSON.stringify(dados)}`;
    } else if (tipo === 'cronograma') {
      prompt = `Analise esse cronograma de obra e identifique riscos: ${JSON.stringify(dados)}`;
    } else if (tipo === 'recursos') {
      prompt = `Sugira alocação otimizada de recursos: ${JSON.stringify(dados)}`;
    }

    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          analise: { type: 'string' },
          sugestoes: { type: 'array', items: { type: 'string' } },
          risco: { type: 'string', enum: ['baixo', 'medio', 'alto'] }
        }
      }
    });

    return Response.json(resposta);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});