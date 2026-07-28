import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, orcamento_id } = await req.json();
    if (!obra_id && !orcamento_id) {
      return Response.json({ error: 'obra_id ou orcamento_id obrigatório' }, { status: 400 });
    }

    // Buscar itens do orçamento
    const items = await base44.entities.OrcamentoItem.filter({ 
      ...(orcamento_id && { orcamento_id }),
      ...(obra_id && { obra_id })
    });

    let demandas_criadas = 0;
    const detalhes = [];

    // Para cada item, buscar composições e insumos
    for (const item of items) {
      const composicoes = await base44.entities.Composicao.filter({
        orcamento_item_id: item.id
      });

      for (const comp of composicoes) {
        const insumos = await base44.entities.ComposicaoInsumo.filter({
          composicao_id: comp.id
        });

        for (const insumo of insumos) {
          // Buscar ou criar Insumo (se não existir)
          let insumo_obj = null;
          const insumos_existentes = await base44.entities.Insumo.filter({
            codigo: insumo.codigo_insumo
          });

          if (insumos_existentes.length === 0) {
            insumo_obj = await base44.entities.Insumo.create({
              codigo: insumo.codigo_insumo,
              descricao: insumo.descricao,
              unidade: insumo.unidade,
              grupo: 'material',
              tipo: 'material',
              origem: 'importado',
              preco_referencia: insumo.valor_unitario || 0,
              preco_ultima_compra: insumo.valor_unitario || 0,
              status_precificacao: 'ok',
              ativo: true
            });
          } else {
            insumo_obj = insumos_existentes[0];
          }

          // Criar demanda de estoque
          const quantidade_necessaria = (insumo.quantidade || 1) * (item.quantidade || 1);
          const demanda = await base44.entities.DemandaEstoqueObra.create({
            obra_id: obra_id,
            insumo_id: insumo_obj.id,
            orcamento_item_id: item.id,
            composicao_id: comp.id,
            quantidade_necessaria: quantidade_necessaria,
            unidade: insumo.unidade,
            descricao_insumo: insumo.descricao,
            valor_unitario: insumo.valor_unitario || 0,
            valor_total: quantidade_necessaria * (insumo.valor_unitario || 0),
            status: 'pendente',
            data_criacao: new Date().toISOString().split('T')[0]
          });

          demandas_criadas++;
          detalhes.push({
            insumo: insumo.descricao,
            quantidade: quantidade_necessaria,
            unidade: insumo.unidade,
            valor_total: quantidade_necessaria * (insumo.valor_unitario || 0)
          });
        }
      }
    }

    return Response.json({
      status: 'sucesso',
      demandas_criadas,
      valor_total_demanda: detalhes.reduce((sum, d) => sum + d.valor_total, 0),
      detalhes
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});