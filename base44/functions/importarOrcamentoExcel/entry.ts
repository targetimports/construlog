import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const orcamentoId = formData.get('orcamentoId');

    if (!file) {
      return Response.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }

    // Upload do arquivo
    const fileBuffer = await file.arrayBuffer();
    const uploadResult = await base44.integrations.Core.UploadFile({ file: fileBuffer });

    // Extração de dados do Excel
    const schema = {
      type: 'object',
      properties: {
        etapa: { type: 'string' },
        codigo: { type: 'string' },
        descricao: { type: 'string' },
        unidade: { type: 'string' },
        quantidade: { type: 'number' },
        valor_unitario: { type: 'number' },
        categoria: { type: 'string' }
      }
    };

    const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: uploadResult.file_url,
      json_schema: schema
    });

    if (extractResult.status !== 'success') {
      return Response.json({ error: 'Erro ao processar Excel', details: extractResult.details }, { status: 400 });
    }

    const items = Array.isArray(extractResult.output) ? extractResult.output : [extractResult.output];
    
    // Criar/atualizar itens do orçamento
    const createdItems = [];
    for (const item of items) {
      const valor_total = (item.quantidade || 0) * (item.valor_unitario || 0);
      
      const newItem = await base44.entities.ItemOrcamento.create({
        orcamento_id: orcamentoId,
        etapa: item.etapa || 'Geral',
        codigo: item.codigo || '',
        descricao: item.descricao,
        unidade: item.unidade || 'un',
        quantidade: item.quantidade || 0,
        categoria: item.categoria || 'outros',
        custo_unitario: item.valor_unitario || 0,
        custo_total: valor_total,
        valor_unitario: item.valor_unitario || 0,
        valor_total: valor_total
      });
      
      createdItems.push(newItem);
    }

    // Atualizar totais do orçamento
    const totalCusto = createdItems.reduce((acc, item) => acc + (item.valor_total || 0), 0);
    await base44.entities.Orcamento.update(orcamentoId, {
      valor_orcado: totalCusto
    });

    return Response.json({ 
      success: true, 
      itemsCreated: createdItems.length,
      items: createdItems,
      totalValue: totalCusto
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});