import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { composicao_id } = await req.json();

    if (!composicao_id) {
      return Response.json({ error: 'composicao_id is required' }, { status: 400 });
    }

    // Buscar composição
    const composicoes = await base44.entities.Composicao.filter({ id: composicao_id });
    if (!composicoes.length) {
      return Response.json({ error: 'Composição não encontrada' }, { status: 404 });
    }
    const composicao = composicoes[0];

    // Buscar itens
    const itens = await base44.entities.ComposicaoItem.filter({ composicao_id });

    let totais = {
      custo_total: 0,
      custo_materiais: 0,
      custo_mao_obra: 0,
      custo_equipamentos: 0,
      custo_outros: 0
    };

    // Recalcular cada item
    for (const item of itens) {
      let preco = item.preco_unitario_snapshot || 0;

      // Se houver insumo_id, puxar preço atualizado
      if (item.insumo_id) {
        try {
          const insumoList = await base44.entities.Insumo.filter({ id: item.insumo_id });
          if (insumoList.length) {
            const insumo = insumoList[0];
            preco = insumo.preco_unitario || 0;

            // Atualizar snapshots
            await base44.entities.ComposicaoItem.update(item.id, {
              codigo_insumo_snapshot: insumo.codigo,
              descricao_insumo_snapshot: insumo.descricao,
              unidade_snapshot: insumo.unidade,
              grupo_snapshot: insumo.grupo,
              preco_unitario_snapshot: preco
            });
          }
        } catch (e) {
          console.log('Insumo não encontrado, mantendo snapshot');
        }
      }

      // Calcular custo do item: coef * (1 + perda%) * preco
      const fatorPerda = 1 + (item.perda_percent || 0) / 100;
      const custo_item = item.coeficiente * fatorPerda * preco;

      // Atualizar item
      await base44.entities.ComposicaoItem.update(item.id, {
        custo_total_item: custo_item
      });

      // Somar por grupo
      totais.custo_total += custo_item;

      const grupo = item.grupo_snapshot;
      if (grupo === 'material') totais.custo_materiais += custo_item;
      else if (grupo === 'mao_obra') totais.custo_mao_obra += custo_item;
      else if (grupo === 'equipamento') totais.custo_equipamentos += custo_item;
      else totais.custo_outros += custo_item;
    }

    // Atualizar composição
    await base44.entities.Composicao.update(composicao_id, {
      ...totais,
      atualizado_por: user.email
    });

    return Response.json({
      status: 'sucesso',
      composicao_id,
      ...totais,
      itens_atualizados: itens.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});