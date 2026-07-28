import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, itens_orcamento, composicoes } = await req.json();

    if (!obra_id || !itens_orcamento || !composicoes) {
      return Response.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 });
    }

    let vinculados = 0;
    let naoVinculados = [];

    // Para cada item do orçamento, tentar vincular uma composição
    for (const item of itens_orcamento) {
      // Buscar composição por item_num ou código
      const comp = composicoes.find(c => 
        (c.comp_num === item.item_num) || 
        (c.codigo === item.codigo)
      );

      if (comp) {
        // Atualizar item com composicao_id
        await base44.asServiceRole.entities.ItemOrcamento.update(item.id, {
          composicao_id: comp.id
        });
        vinculados++;
      } else {
        naoVinculados.push({
          item_num: item.item_num,
          descricao: item.descricao,
          razo: 'Composição não encontrada'
        });
      }
    }

    return Response.json({
      sucesso: true,
      vinculados: vinculados,
      nao_vinculados: naoVinculados.length,
      taxa_vinculacao: `${vinculados}/${itens_orcamento.length}`
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});