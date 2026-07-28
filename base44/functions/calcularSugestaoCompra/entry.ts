import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { almoxarifado_id, de, ate, janela_dias } = await req.json();

    if (!almoxarifado_id) {
      return Response.json({ error: 'almoxarifado_id obrigatório' }, { status: 400 });
    }

    const dataFim = ate ? new Date(ate) : new Date();
    const dataInicio = de ? new Date(de) : new Date(dataFim.getTime() - (janela_dias || 30) * 24 * 60 * 60 * 1000);

    // Buscar políticas do almoxarifado
    const politicas = await base44.entities.PoliticaEstoque.filter({
      almoxarifado_id,
      ativo: true
    });

    if (politicas.length === 0) {
      return Response.json({ ok: true, data: { id: 'empty', data: { itens: [] } }, message: 'Nenhuma política encontrada', itens_count: 0 });
    }

    // Buscar movimentações de saída (consumo)
    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      almoxarifado_origem_id: almoxarifado_id,
      tipo: 'saida_consumo'
    }, '-data_movimentacao', 500);

    const consumoPorInsumo = {};
    movimentacoes.forEach(mov => {
      const movDate = new Date(mov.data_movimentacao);
      if (movDate >= dataInicio && movDate <= dataFim) {
        if (!consumoPorInsumo[mov.insumo_id]) consumoPorInsumo[mov.insumo_id] = 0;
        consumoPorInsumo[mov.insumo_id] += mov.quantidade || 0;
      }
    });

    // Buscar saldos atuais
    const saldos = await base44.entities.SaldoEstoque.filter({
      almoxarifado_id
    });

    const saldoPorInsumo = {};
    saldos.forEach(s => {
      saldoPorInsumo[s.data?.insumo_id || s.insumo_id] = s.data?.quantidade_disponivel || s.quantidade_disponivel || 0;
    });

    // Calcular sugestões
    const itens = [];
    for (const pol of politicas) {
      const insId = pol.data?.insumo_id || pol.insumo_id;
      const consumo = consumoPorInsumo[insId] || 0;
      const saldo = saldoPorInsumo[insId] || 0;

      const maximo = pol.data?.maximo || pol.maximo || 0;
      const lote = pol.data?.lote_compra || pol.lote_compra || 1;
      const minimo = pol.data?.minimo || pol.minimo || 0;

      const necessario = Math.max(0, maximo - saldo);
      let sugerido = Math.ceil(necessario / lote) * lote;

      if (sugerido > 0 || saldo < minimo) {
        let insumoData = null;
        try {
          const insResults = await base44.entities.Insumo.filter({ id: insId });
          insumoData = insResults[0];
        } catch (e) {
          // Continue mesmo se insumo não existe
        }

        itens.push({
          insumo_id: insId,
          descricao_insumo: insumoData?.data?.descricao || insumoData?.descricao || 'N/A',
          unidade: insumoData?.data?.unidade || insumoData?.unidade || 'un',
          consumo_periodo: consumo,
          saldo_atual: saldo,
          minimo,
          maximo,
          lote_compra: lote,
          sugerido: Math.max(0, sugerido)
        });
      }
    }

    // Criar registro de sugestão
    const sugestao = await base44.entities.SugestaoCompra.create({
      almoxarifado_id,
      periodo_de: dataInicio.toISOString().split('T')[0],
      periodo_ate: dataFim.toISOString().split('T')[0],
      itens,
      status: 'gerada'
    });

    return Response.json({ ok: true, data: sugestao, itens_count: itens.length });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});