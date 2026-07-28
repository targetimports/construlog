import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      obra_id,
      orcamento_id,
      itens_consumo, // [{ insumo_id, quantidade, etapa }]
      tipo_consumo = 'normal'
    } = body;

    if (!obra_id || !itens_consumo || itens_consumo.length === 0) {
      return Response.json({
        error: 'obra_id e itens_consumo são obrigatórios'
      }, { status: 400 });
    }

    // Validar que a obra existe e obter almoxarifado
    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    const almoxs = await base44.entities.Almoxarifado.filter({
      tipo: 'obra',
      obra_id
    });
    const almoxarifado_obra = almoxs[0];
    if (!almoxarifado_obra) {
      return Response.json({ error: 'Almoxarifado da obra não encontrado' }, { status: 404 });
    }

    // Processar cada consumo
    for (const consumo of itens_consumo) {
      const { insumo_id, quantidade, etapa } = consumo;

      if (!insumo_id || !quantidade) {
        return Response.json({
          error: 'Cada item de consumo deve ter insumo_id e quantidade',
          insumo_id
        }, { status: 400 });
      }

      // Verificar disponibilidade em estoque
      const saldos = await base44.entities.SaldoEstoque.filter({
        insumo_id,
        almoxarifado_id: almoxarifado_obra.id
      });

      if (saldos.length === 0 || (saldos[0].quantidade_disponivel || 0) < quantidade) {
        return Response.json({
          error: `Estoque insuficiente para o insumo ${insumo_id}. Disponível: ${saldos[0]?.quantidade_disponivel || 0}`,
          insumo_id
        }, { status: 400 });
      }

      const saldo = saldos[0];

      // Obter preço do insumo
      const insumo = await base44.entities.Insumo.get(insumo_id);

      // Registrar consumo no histórico
      await base44.entities.ConsumoEstoqueObra.create({
        obra_id,
        orcamento_id,
        insumo_id,
        etapa: etapa || 'não especificada',
        quantidade_consumida: quantidade,
        custo_real: quantidade * (insumo?.preco_unitario || 0),
        data_consumo: new Date().toISOString(),
        responsavel: user.email,
        tipo_movimento: tipo_consumo
      });

      // Baixar estoque
      const nova_quantidade = (saldo.quantidade_total || 0) - quantidade;
      await base44.entities.SaldoEstoque.update(saldo.id, {
        quantidade_total: nova_quantidade,
        quantidade_disponivel: nova_quantidade - (saldo.quantidade_reservada || 0),
        valor_total_estoque: nova_quantidade * (saldo.custo_unitario_medio || 0),
        data_ultima_movimentacao: new Date().toISOString()
      });

      // Registrar movimentação
      await base44.entities.MovimentacaoEstoque.create({
        insumo_id,
        tipo: 'consumo',
        quantidade,
        obra_origem_id: obra_id,
        almoxarifado_origem_id: almoxarifado_obra.id,
        orcamento_id,
        etapa_obra: etapa,
        data_movimentacao: new Date().toISOString().split('T')[0],
        responsavel: user.email,
        tipo_consumo,
        observacoes: `Consumo na obra ${obra.nome}`
      });
    }

    return Response.json({
      obra_id,
      total_itens_consumidos: itens_consumo.length,
      mensagem: 'Consumo registrado e estoque atualizado'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});