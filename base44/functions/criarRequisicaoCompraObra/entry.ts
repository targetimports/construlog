import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, demanda_ids, fornecedor_id, observacoes } = await req.json();
    if (!obra_id || !demanda_ids || demanda_ids.length === 0) {
      return Response.json({ error: 'Parâmetros obrigatórios' }, { status: 400 });
    }

    // Buscar demandas
    const demandas = await Promise.all(
      demanda_ids.map(id => base44.entities.DemandaEstoqueObra.filter({ id }))
    );

    let valor_total = 0;
    const itens_requisicao = [];

    // Criar RequisicaoCompra
    const requisicao = await base44.entities.RequisicaoCompra.create({
      obra_id,
      solicitante_email: user.email,
      fornecedor_id: fornecedor_id || null,
      status: 'pendente_aprovacao',
      data_solicitacao: new Date().toISOString().split('T')[0],
      observacoes
    });

    // Adicionar itens à requisição
    for (const demanda_array of demandas) {
      if (demanda_array.length > 0) {
        const demanda = demanda_array[0];
        valor_total += demanda.valor_total || 0;

        const item = await base44.entities.RequisicaoCompraItem.create({
          requisicao_compra_id: requisicao.id,
          insumo_id: demanda.insumo_id,
          quantidade: demanda.quantidade_necessaria,
          valor_unitario: demanda.valor_unitario,
          valor_total: demanda.valor_total,
          descricao: demanda.descricao_insumo,
          demanda_id: demanda.id
        });

        // Atualizar demanda para vinculada
        await base44.entities.DemandaEstoqueObra.update(demanda.id, {
          status: 'requisicao_criada',
          requisicao_id: requisicao.id
        });

        itens_requisicao.push({
          insumo: demanda.descricao_insumo,
          quantidade: demanda.quantidade_necessaria,
          valor_total: demanda.valor_total
        });
      }
    }

    // Atualizar valor total da requisição
    await base44.entities.RequisicaoCompra.update(requisicao.id, {
      valor_total
    });

    // Notificar aprovadores (admin)
    const adminUsers = await base44.asServiceRole.entities.User.filter({
      role: 'admin'
    });

    for (const admin of adminUsers) {
      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `Nova Requisição de Compra - Obra: ${obra_id}`,
        body: `Uma nova requisição de compra foi criada para aprovação.\n\nValor Total: R$ ${valor_total.toFixed(2)}\nSolicitante: ${user.email}\n\nAcesse o sistema para aprovar.`
      });
    }

    return Response.json({
      status: 'sucesso',
      requisicao_id: requisicao.id,
      quantidade_itens: itens_requisicao.length,
      valor_total,
      itens_requisicao
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});