import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_id_externo, obra_id } = await req.json();

    const apiKey = Deno.env.get('ORCAFACIL_API_KEY');
    const apiUrl = Deno.env.get('ORCAFACIL_API_URL') || 'https://api.orcafascio.com';

    if (!apiKey) {
      return Response.json({ error: 'ORCAFACIL_API_KEY não configurada' }, { status: 400 });
    }

    if (!orcamento_id_externo || !obra_id) {
      return Response.json({ error: 'orcamento_id_externo e obra_id são obrigatórios' }, { status: 400 });
    }

    // Buscar orçamento da API do Orça Fácil
    const orcamentoResponse = await fetch(`${apiUrl}/orcamentos/${orcamento_id_externo}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!orcamentoResponse.ok) {
      throw new Error('Erro ao buscar orçamento da API do Orça Fácil');
    }

    const orcamentoExterno = await orcamentoResponse.json();

    // Buscar composições e itens
    const itensResponse = await fetch(`${apiUrl}/orcamentos/${orcamento_id_externo}/itens`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const itensExternos = itensResponse.ok ? await itensResponse.json() : [];

    // Criar orçamento no sistema
    const orcamento = await base44.asServiceRole.entities.Orcamento.create({
      obra_id: obra_id,
      codigo: orcamentoExterno.codigo || `ORC-${Date.now()}`,
      descricao: orcamentoExterno.descricao || 'Orçamento do Orça Fácil',
      valor_total: orcamentoExterno.valor_total || 0,
      bdi: orcamentoExterno.bdi || 0,
      status: 'em_analise',
      data_elaboracao: new Date().toISOString().split('T')[0],
      importado_orca_facil: true,
      orcamento_externo_id: orcamento_id_externo
    });

    // Criar itens do orçamento com composições
    const itensImportados = [];
    for (const itemExterno of itensExternos) {
      // Buscar composição detalhada do item
      let composicao = [];
      if (itemExterno.id) {
        const composicaoResponse = await fetch(
          `${apiUrl}/itens/${itemExterno.id}/composicao`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (composicaoResponse.ok) {
          const compData = await composicaoResponse.json();
          composicao = compData.map(c => ({
            tipo: c.tipo || 'material',
            descricao: c.descricao,
            unidade: c.unidade,
            coeficiente: c.coeficiente || c.quantidade,
            preco_unitario: c.preco_unitario || c.preco,
            preco_total: (c.coeficiente || c.quantidade) * (c.preco_unitario || c.preco)
          }));
        }
      }

      const itemCriado = await base44.asServiceRole.entities.ItemOrcamento.create({
        orcamento_id: orcamento.id,
        codigo: itemExterno.codigo || '',
        descricao: itemExterno.descricao,
        unidade: itemExterno.unidade,
        quantidade: itemExterno.quantidade,
        preco_unitario: itemExterno.preco_unitario || itemExterno.preco,
        preco_total: itemExterno.preco_total || (itemExterno.quantidade * itemExterno.preco_unitario),
        etapa: itemExterno.etapa || itemExterno.grupo || 'geral',
        composicao: composicao
      });

      itensImportados.push(itemCriado);
    }

    return Response.json({
      sucesso: true,
      orcamento: orcamento,
      itens_importados: itensImportados.length,
      valor_total: orcamentoExterno.valor_total,
      mensagem: `Orçamento sincronizado! ${itensImportados.length} itens importados da API do Orça Fácil.`
    });
  } catch (error) {
    console.error('Erro ao sincronizar Orça Fácil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});