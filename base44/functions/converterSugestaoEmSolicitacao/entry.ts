import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { sugestao_id, obra_id, modo } = await req.json();
    const modo_final = modo || 'reposicao_deposito';

    if (!sugestao_id) {
      return Response.json({ error: 'sugestao_id obrigatório' }, { status: 400 });
    }

    // Buscar sugestão
    const sugestoes = await base44.entities.SugestaoCompra.filter({ id: sugestao_id });
    if (!sugestoes.length) {
      return Response.json({ error: 'Sugestão não encontrada' }, { status: 404 });
    }

    const sugestao = sugestoes[0];
    const itens = (sugestao.data?.itens || sugestao.itens || []);

    // Filtrar apenas itens com sugerido > 0
    const itensValidos = itens.filter(i => (i.sugerido || 0) > 0);

    if (itensValidos.length === 0) {
      return Response.json({ error: 'Nenhum item sugerido para converter' }, { status: 400 });
    }

    // Validar e resolver obra_id conforme modo
    let obraFinal = obra_id;

    if (modo_final === 'solicitacao_obra') {
      // Modo solicitação de obra: obra_id é OBRIGATÓRIO
      if (!obraFinal) {
        return Response.json(
          { error: 'obra_id é obrigatório para solicitação da obra', field: 'obra_id' },
          { status: 400 }
        );
      }
      const obras = await base44.entities.Obra.filter({ id: obraFinal });
      if (!obras.length) {
        return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
      }
    } else if (modo_final === 'reposicao_deposito') {
      // Modo reposição de depósito: obra_id auto-preenchido com Obra Administrativa
      if (!obraFinal) {
        try {
          const obrasAdmin = await base44.entities.Obra.filter({ nome: 'Administrativa' });
          if (obrasAdmin && obrasAdmin.length > 0) {
            obraFinal = obrasAdmin[0].id;
          } else {
            // Criar Obra Administrativa se não existir
            const novaObra = await base44.asServiceRole.entities.Obra.create({
              nome: 'Administrativa',
              cliente: 'Sistema',
              tipo: 'privada',
              tipo_obra: 'outros',
              fase: 'ativa',
              status: 'em_andamento',
              descricao: 'Obra administrativa para lançamentos administrativos'
            });
            obraFinal = novaObra.id;
          }
        } catch (e) {
          console.error('Erro ao obter/criar Obra Administrativa:', e);
          return Response.json({ error: 'Falha ao obter Obra Administrativa' }, { status: 500 });
        }
      }
    }

    // Criar RequisicaoCompra
    const solicitacao = await base44.entities.RequisicaoCompra.create({
      titulo: `Sugestão de Compra - Almox ${sugestao.almoxarifado_id || sugestao.data?.almoxarifado_id}`,
      descricao_resumo: `Gerada automaticamente do período ${sugestao.periodo_de || sugestao.data?.periodo_de} a ${sugestao.periodo_ate || sugestao.data?.periodo_ate}`,
      obra_id: obraFinal,
      data_solicitacao: new Date().toISOString().split('T')[0],
      status: 'aguardando',
      solicitante: user.email,
      origem_sugestao_id: sugestao_id,
      almoxarifado_id: sugestao.almoxarifado_id || sugestao.data?.almoxarifado_id,
      modo: modo_final,
      itens: itensValidos.map(item => ({
        insumo_id: item.insumo_id,
        descricao: item.descricao_insumo,
        unidade: item.unidade,
        quantidade_solicitada: item.sugerido,
        valor_estimado: 0,
        status: 'em_aberto'
      })),
      valor_total_estimado: 0,
      qtd_itens: itensValidos.length
    });

    // Marcar sugestão como convertida
    await base44.entities.SugestaoCompra.update(sugestao_id, { status: 'convertida' });

    return Response.json({
      ok: true,
      sugestao_id,
      solicitacao_id: solicitacao.id,
      obra_id: obraFinal,
      modo: modo_final,
      itens_convertidos: itensValidos.length,
      message: 'Solicitação de Compra criada'
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});