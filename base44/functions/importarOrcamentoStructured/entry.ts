import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_url, composicoes_url, cronograma_url, nome_obra } = await req.json();

    if (!orcamento_url || !nome_obra) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    // EXTRACT BUDGET DATA
    const rawData = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: orcamento_url,
      json_schema: { type: 'object', properties: { col_0: { type: 'string' }, col_1: { type: 'string' }, Obra: { type: 'string' } } }
    });

    // PROCESS WITH AI
    const processed = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract all budget items from this data. Return JSON with items array containing: item_numero, descricao, unidade, quantidade, valor_unitario, valor_total.`,
      prompt: `Data: ${JSON.stringify(rawData.output || rawData).substring(0, 8000)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { item_numero: { type: 'string' }, descricao: { type: 'string' }, valor_total: { type: 'number' } } }
          }
        }
      }
    });

    // CREATE OBRA
    const obra = await base44.entities.Obra.create({
      nome: nome_obra,
      tipo: 'privada',
      tipo_obra: 'edificacao',
      status: 'orcamento',
      cliente: 'A Definir',
      fase: 'orcamento',
      data_inicio: new Date().toISOString().split('T')[0]
    });

    // CREATE ORCAMENTO
    const valor_total = (processed.items || []).reduce((sum, i) => sum + (i.valor_total || 0), 0);
    
    const orcamento = await base44.entities.Orcamento.create({
      obra_id: obra.id,
      versao: 'V1',
      titulo: `Orçamento ${nome_obra} V1`,
      data_criacao: new Date().toISOString().split('T')[0],
      status: 'rascunho',
      valor_total: valor_total,
      valor_proposta: valor_total
    });

    // CREATE ITEMS
    let itens_criados = 0;
    for (const item of (processed.items || [])) {
      if (item.descricao && item.valor_total > 0) {
        await base44.entities.OrcamentoItem.create({
          orcamento_id: orcamento.id,
          obra_id: obra.id,
          numero_item: item.item_numero || '',
          descricao: item.descricao,
          unidade: item.unidade || 'un',
          quantidade: item.quantidade || 1,
          valor_unitario: item.valor_unitario || 0,
          valor_total: item.valor_total,
          categoria: 'servicos',
          status: 'planejado'
        });
        itens_criados++;
      }
    }

    return Response.json({
      status: 'sucesso',
      obra_id: obra.id,
      orcamento_id: orcamento.id,
      resumo: {
        nome_obra: obra.nome,
        itens_importados: itens_criados,
        valor_total: valor_total,
        status_obra: 'pronta_para_execucao'
      }
    });

  } catch (error) {
    return Response.json({ error: error.message, status: 'erro' }, { status: 500 });
  }
});