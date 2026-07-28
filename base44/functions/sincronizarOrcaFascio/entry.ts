import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orcamento_id_externo, obra_id } = body;

    if (!orcamento_id_externo || !obra_id) {
      return Response.json({ error: 'orcamento_id_externo e obra_id são obrigatórios' }, { status: 400 });
    }

    const apiKey = Deno.env.get('ORCAFASCIO_API_KEY');
    const apiUrl = 'https://api.orcafascio.com/api/v1';

    if (!apiKey) {
      return Response.json({ error: 'ORCAFASCIO_API_KEY não configurada' }, { status: 400 });
    }

    // Buscar orçamento específico da API
    const response = await fetch(`${apiUrl}/orcamentos/${orcamento_id_externo}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Orçamento não encontrado na API do OrcaFascio');
    }

    const orcamentoData = await response.json();

    // Buscar a obra
    const obra = await base44.entities.Obra.filter({ id: obra_id });
    if (!obra || obra.length === 0) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Criar novo orçamento no sistema
    const novoOrcamento = await base44.entities.Orcamento.create({
      codigo: `OrcaFascio-${orcamento_id_externo}`,
      obra_id: obra_id,
      descricao: orcamentoData.descricao || `Importado do OrcaFascio`,
      valor_total: orcamentoData.valor_total || 0,
      status: 'orcamento',
      fonte_externa: 'orcafascio',
      id_externo: orcamento_id_externo
    });

    // Processar itens do orçamento
    let itensImportados = 0;
    let valorTotal = 0;

    if (orcamentoData.itens && Array.isArray(orcamentoData.itens)) {
      for (const item of orcamentoData.itens) {
        try {
          await base44.entities.ItemOrcamento.create({
            orcamento_id: novoOrcamento.id,
            etapa: item.etapa || 'Não informada',
            descricao: item.descricao,
            unidade: item.unidade || 'un',
            quantidade: item.quantidade || 0,
            custo_unitario: item.custo_unitario || 0,
            custo_total: (item.quantidade || 0) * (item.custo_unitario || 0),
            valor_unitario: item.valor_unitario || item.custo_unitario || 0,
            valor_total: (item.quantidade || 0) * (item.valor_unitario || item.custo_unitario || 0),
            categoria: item.categoria || 'servicos',
            bdi: item.bdi || 0
          });
          itensImportados++;
          valorTotal += (item.quantidade || 0) * (item.valor_unitario || item.custo_unitario || 0);
        } catch (itemError) {
          console.error('Erro ao importar item:', itemError);
        }
      }
    }

    return Response.json({
      sucesso: true,
      mensagem: 'Orçamento sincronizado com sucesso',
      orcamento: {
        id: novoOrcamento.id,
        codigo: novoOrcamento.codigo
      },
      itens_importados: itensImportados,
      valor_total: valorTotal
    });

  } catch (error) {
    console.error('Erro ao sincronizar OrcaFascio:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});