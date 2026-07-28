import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { transferencia_id, itens_confirmados } = body;

    if (!transferencia_id || !itens_confirmados) {
      return Response.json({ 
        error: 'transferencia_id e itens_confirmados são obrigatórios' 
      }, { status: 400 });
    }

    const transferencia = await base44.entities.TransferenciaEstoque.get(transferencia_id);
    if (!transferencia) {
      return Response.json({ error: 'Transferência não encontrada' }, { status: 404 });
    }

    // Atualizar transferência como recebida
    await base44.entities.TransferenciaEstoque.update(transferencia_id, {
      status: 'recebida',
      data_transferencia: new Date().toISOString(),
      responsavel_destino: user.email
    });

    // Para cada item confirmado:
    // 1. Baixar do estoque de origem (Estoque Central)
    // 2. Adicionar ao estoque da obra
    for (const item of itens_confirmados) {
      // Baixar do estoque de origem
      const saldos_origem = await base44.entities.SaldoEstoque.filter({
        insumo_id: item.insumo_id,
        almoxarifado_id: transferencia.almoxarifado_origem_id
      });

      if (saldos_origem.length > 0) {
        const saldo_origem = saldos_origem[0];
        const nova_total_origem = (saldo_origem.quantidade_total || 0) - (item.quantidade_transferida || 0);
        const nova_reserva = Math.max(0, (saldo_origem.quantidade_reservada || 0) - (item.quantidade_transferida || 0));

        await base44.entities.SaldoEstoque.update(saldo_origem.id, {
          quantidade_total: nova_total_origem,
          quantidade_reservada: nova_reserva,
          quantidade_disponivel: nova_total_origem - nova_reserva,
          data_ultima_movimentacao: new Date().toISOString()
        });
      }

      // Adicionar ao estoque da obra (destino)
      const saldos_destino = await base44.entities.SaldoEstoque.filter({
        insumo_id: item.insumo_id,
        almoxarifado_id: transferencia.almoxarifado_destino_id
      });

      if (saldos_destino.length > 0) {
        const saldo_destino = saldos_destino[0];
        const nova_total_destino = (saldo_destino.quantidade_total || 0) + (item.quantidade_transferida || 0);

        await base44.entities.SaldoEstoque.update(saldo_destino.id, {
          quantidade_total: nova_total_destino,
          quantidade_disponivel: nova_total_destino - (saldo_destino.quantidade_reservada || 0),
          data_ultima_movimentacao: new Date().toISOString()
        });
      } else {
        // Criar novo saldo na obra
        const insumo = await base44.entities.Insumo.get(item.insumo_id);
        await base44.entities.SaldoEstoque.create({
          insumo_id: item.insumo_id,
          almoxarifado_id: transferencia.almoxarifado_destino_id,
          codigo_insumo: insumo?.codigo || '',
          descricao_insumo: insumo?.descricao || '',
          unidade: insumo?.unidade || '',
          quantidade_total: item.quantidade_transferida || 0,
          quantidade_disponivel: item.quantidade_transferida || 0,
          custo_unitario_medio: insumo?.preco_unitario || 0,
          valor_total_estoque: (item.quantidade_transferida || 0) * (insumo?.preco_unitario || 0),
          data_ultima_movimentacao: new Date().toISOString()
        });
      }

      // Registrar movimentação
      await base44.entities.MovimentacaoEstoque.create({
        insumo_id: item.insumo_id,
        tipo: 'transferencia',
        quantidade: item.quantidade_transferida || 0,
        almoxarifado_origem_id: transferencia.almoxarifado_origem_id,
        almoxarifado_destino_id: transferencia.almoxarifado_destino_id,
        obra_destino_id: transferencia.obra_destino_id,
        data_movimentacao: new Date().toISOString().split('T')[0],
        responsavel: user.email,
        observacoes: `Transferência ${transferencia.numero} recebida pela obra`
      });
    }

    return Response.json({
      transferencia_id,
      status: 'recebida',
      numero: transferencia.numero,
      total_itens_transferidos: itens_confirmados.length,
      observacao: 'Transferência confirmada. Material disponível no estoque da obra'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});