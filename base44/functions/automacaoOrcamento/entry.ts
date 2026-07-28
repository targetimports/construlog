import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { descricao_obra, tipo_obra, area_m2, materiais_especificos } = await req.json();

    if (!descricao_obra || !tipo_obra) {
      return Response.json({ error: 'descricao_obra e tipo_obra são obrigatórios' }, { status: 400 });
    }

    // Buscar referências SINAPI
    const sinapi = await base44.entities.TabelaSINAPI.list();
    const sili = await base44.entities.TabelaSILI.list();

    const prompt = `Você é um especialista em orçamentos de obras. Crie um orçamento detalhado baseado nas seguintes informações:

Obra: ${descricao_obra}
Tipo: ${tipo_obra}
Área: ${area_m2 || 'Não informada'} m²
Materiais específicos: ${materiais_especificos || 'Nenhum'}

Use as tabelas de referência SINAPI e SILI disponíveis para composições de preços.

Retorne um JSON com a seguinte estrutura:
{
  "resumo": {
    "valor_total_estimado": number,
    "prazo_estimado_dias": number,
    "bdi_sugerido": number
  },
  "composicoes": [
    {
      "codigo_referencia": "código SINAPI ou SILI",
      "descricao": "descrição do serviço/item",
      "unidade": "unidade",
      "quantidade_estimada": number,
      "preco_unitario": number,
      "preco_total": number,
      "etapa": "fundacao|estrutura|alvenaria|acabamento|instalacoes",
      "observacoes": "observações relevantes"
    }
  ],
  "cronograma_sugerido": [
    {
      "etapa": "nome da etapa",
      "duracao_dias": number,
      "inicio_sugerido": number,
      "fim_sugerido": number
    }
  ]
}`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          resumo: {
            type: 'object',
            properties: {
              valor_total_estimado: { type: 'number' },
              prazo_estimado_dias: { type: 'number' },
              bdi_sugerido: { type: 'number' }
            }
          },
          composicoes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo_referencia: { type: 'string' },
                descricao: { type: 'string' },
                unidade: { type: 'string' },
                quantidade_estimada: { type: 'number' },
                preco_unitario: { type: 'number' },
                preco_total: { type: 'number' },
                etapa: { type: 'string' },
                observacoes: { type: 'string' }
              }
            }
          },
          cronograma_sugerido: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                etapa: { type: 'string' },
                duracao_dias: { type: 'number' },
                inicio_sugerido: { type: 'number' },
                fim_sugerido: { type: 'number' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      sucesso: true,
      orcamento: resultado
    });
  } catch (error) {
    console.error('Erro na automação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});