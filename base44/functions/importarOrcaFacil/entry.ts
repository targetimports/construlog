import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { arquivo_url, obra_id } = await req.json();

    if (!arquivo_url || !obra_id) {
      return Response.json({ error: 'arquivo_url e obra_id são obrigatórios' }, { status: 400 });
    }

    // Buscar o arquivo e extrair dados usando IA
    const prompt = `Você é um especialista em análise de orçamentos de obras.
    
Analise o arquivo de orçamento do Orça Fácil e extraia TODAS as composições, serviços e custos.

IMPORTANTE: Para cada item, extraia:
- Código da composição (se houver)
- Descrição completa do serviço
- Unidade de medida
- Quantidade total
- Preço unitário
- Preço total
- Etapa/grupo da obra
- Insumos da composição (materiais, mão de obra, equipamentos com coeficientes)

Retorne um JSON completo com a seguinte estrutura:
{
  "resumo": {
    "valor_total": number,
    "bdi": number,
    "quantidade_itens": number
  },
  "itens": [
    {
      "codigo": "string",
      "descricao": "string",
      "unidade": "string",
      "quantidade": number,
      "preco_unitario": number,
      "preco_total": number,
      "etapa": "string",
      "composicao": [
        {
          "tipo": "material|mao_obra|equipamento",
          "descricao": "string",
          "unidade": "string",
          "coeficiente": number,
          "preco_unitario": number,
          "preco_total": number
        }
      ]
    }
  ]
}`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      file_urls: [arquivo_url],
      response_json_schema: {
        type: 'object',
        properties: {
          resumo: {
            type: 'object',
            properties: {
              valor_total: { type: 'number' },
              bdi: { type: 'number' },
              quantidade_itens: { type: 'number' }
            }
          },
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'string' },
                descricao: { type: 'string' },
                unidade: { type: 'string' },
                quantidade: { type: 'number' },
                preco_unitario: { type: 'number' },
                preco_total: { type: 'number' },
                etapa: { type: 'string' },
                composicao: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tipo: { type: 'string' },
                      descricao: { type: 'string' },
                      unidade: { type: 'string' },
                      coeficiente: { type: 'number' },
                      preco_unitario: { type: 'number' },
                      preco_total: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Criar orçamento
    const orcamento = await base44.asServiceRole.entities.Orcamento.create({
      obra_id: obra_id,
      codigo: `ORC-${Date.now()}`,
      descricao: 'Orçamento importado do Orça Fácil',
      valor_total: resultado.resumo?.valor_total || 0,
      bdi: resultado.resumo?.bdi || 0,
      status: 'em_analise',
      data_elaboracao: new Date().toISOString().split('T')[0],
      importado_orca_facil: true
    });

    // Criar itens do orçamento com composições
    const itensImportados = [];
    for (const item of resultado.itens || []) {
      const itemCriado = await base44.asServiceRole.entities.ItemOrcamento.create({
        orcamento_id: orcamento.id,
        codigo: item.codigo || '',
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        preco_total: item.preco_total,
        etapa: item.etapa || 'geral',
        composicao: item.composicao || []
      });

      itensImportados.push(itemCriado);
    }

    return Response.json({
      sucesso: true,
      orcamento: orcamento,
      itens_importados: itensImportados.length,
      valor_total: resultado.resumo?.valor_total,
      mensagem: `Orçamento importado com sucesso! ${itensImportados.length} itens processados.`
    });
  } catch (error) {
    console.error('Erro ao importar Orça Fácil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});