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

    // Buscar composição original
    const comps = await base44.entities.Composicao.filter({ id: composicao_id });
    if (!comps.length) {
      return Response.json({ error: 'Composição não encontrada' }, { status: 404 });
    }
    const original = comps[0];

    // Criar nova composição (status rascunho, origem manual)
    const novaCodigo = `${original.codigo}_CÓPIA_${Date.now()}`.substring(0, 50);
    const novaComp = await base44.entities.Composicao.create({
      codigo: novaCodigo,
      descricao: `${original.descricao} (Cópia)`,
      unidade: original.unidade,
      tipo: original.tipo,
      origem: 'manual',
      status: 'rascunho',
      data_referencia: original.data_referencia,
      estado: original.estado,
      desonerado: original.desonerado,
      atualizado_por: user.email
    });

    // Buscar e duplicar itens
    const itensOriginais = await base44.entities.ComposicaoItem.filter({ 
      composicao_id 
    });

    for (const item of itensOriginais) {
      await base44.entities.ComposicaoItem.create({
        composicao_id: novaComp.id,
        insumo_id: item.insumo_id,
        codigo_insumo_snapshot: item.codigo_insumo_snapshot,
        descricao_insumo_snapshot: item.descricao_insumo_snapshot,
        unidade_snapshot: item.unidade_snapshot,
        grupo_snapshot: item.grupo_snapshot,
        preco_unitario_snapshot: item.preco_unitario_snapshot,
        coeficiente: item.coeficiente,
        perda_percent: item.perda_percent,
        custo_total_item: item.custo_total_item,
        ordem: item.ordem
      });
    }

    return Response.json({
      status: 'sucesso',
      composicao_original_id: composicao_id,
      composicao_nova_id: novaComp.id,
      composicao_nova: novaComp,
      itens_duplicados: itensOriginais.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});