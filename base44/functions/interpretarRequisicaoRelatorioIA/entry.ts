import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requisicaoTexto, contatos = {} } = await req.json();

    if (!requisicaoTexto || requisicaoTexto.trim().length === 0) {
      return Response.json({ error: 'Requisição de texto é obrigatória' }, { status: 400 });
    }

    const prompt = `Você é um assistente de análise de dados para relatórios de construção.
O usuário fez a seguinte requisição em linguagem natural:
"${requisicaoTexto}"

Referências disponíveis:
- Obras: ${JSON.stringify(contatos.obras || [], null, 2)}
- Períodos: últimos 7 dias, 30 dias, 90 dias, ano inteiro
- Tipos de dados: custos, materiais, mão de obra, equipamentos, produtividade, cronograma

Analise a requisição e retorne um JSON com:
{
  "tipoRelatorio": "string (custos|materiais|mao_obra|equipamentos|produtividade|cronograma|customizado)",
  "obraId": "string ou null",
  "obraNome": "string ou null",
  "periodo": "string (7dias|30dias|90dias|anoInteiro)",
  "filtros": { chave: valor },
  "interpretacao": "string resumindo o que o usuário quer",
  "confianca": number (0-1)
}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          tipoRelatorio: { type: 'string' },
          obraId: { type: ['string', 'null'] },
          obraNome: { type: ['string', 'null'] },
          periodo: { type: 'string' },
          filtros: { type: 'object' },
          interpretacao: { type: 'string' },
          confianca: { type: 'number' }
        }
      }
    });

    return Response.json({
      parametros: response,
      requisicaoOriginal: requisicaoTexto,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});