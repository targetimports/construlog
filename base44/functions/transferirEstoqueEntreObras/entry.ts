import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      insumo_id,
      obra_origem_id,
      obra_destino_id,
      quantidade,
      observacao
    } = await req.json();

    // Validações
    if (!insumo_id || !obra_origem_id || !obra_destino_id || !quantidade) {
      return Response.json({ 
        error: 'Campos obrigatórios: insumo_id, obra_origem_id, obra_destino_id, quantidade' 
      }, { status: 400 });
    }

    if (obra_origem_id === obra_destino_id) {
      return Response.json({ 
        error: 'Origem e destino não podem ser iguais' 
      }, { status: 400 });
    }

    if (quantidade <= 0) {
      return Response.json({ 
        error: 'Quantidade deve ser maior que zero' 
      }, { status: 400 });
    }

    // Buscar saldo na obra de origem
    const estoqueOrigem = await base44.entities.EstoqueObra.filter({
      obra_id: obra_origem_id,
      insumo_id: insumo_id
    });

    if (!estoqueOrigem || estoqueOrigem.length === 0) {
      return Response.json({ 
        error: 'Insumo não encontrado no estoque da obra de origem' 
      }, { status: 404 });
    }

    const saldoAtual = estoqueOrigem[0].quantidade_disponivel || 0;

    if (saldoAtual < quantidade) {
      return Response.json({ 
        error: `Saldo insuficiente. Disponível: ${saldoAtual}, Solicitado: ${quantidade}` 
      }, { status: 400 });
    }

    // Pegar dados do insumo
    const insumo = await base44.entities.Insumo.get(insumo_id);
    const custo_unitario = estoqueOrigem[0].custo_unitario || 0;
    const valor_total = quantidade * custo_unitario;

    // 1️⃣ Criar movimentação de SAÍDA na obra origem
    const movSaida = await base44.entities.MovimentacaoEstoque.create({
      data: new Date().toISOString(),
      tipo: 'transf_saida',
      insumo_id,
      codigo_insumo: insumo?.codigo || '',
      descricao_insumo: insumo?.nome || '',
      unidade: insumo?.unidade || '',
      quantidade,
      valor_unitario: custo_unitario,
      valor_total,
      obra_id: obra_origem_id,
      deposito_origem_id: obra_origem_id,
      deposito_destino_id: obra_destino_id,
      referencia_tipo: 'transferencia',
      referencia_id: null, // será atualizado depois
      usuario_id: user.email,
      observacao: `Transferência para obra ${obra_destino_id}: ${observacao || ''}`,
      saldo_anterior: saldoAtual,
      saldo_atual: saldoAtual - quantidade,
      custo_medio_anterior: custo_unitario,
      custo_medio_atual: custo_unitario
    });

    // 2️⃣ Criar movimentação de ENTRADA na obra destino
    const estoqueDestino = await base44.entities.EstoqueObra.filter({
      obra_id: obra_destino_id,
      insumo_id: insumo_id
    });

    const saldoDestinoAnterior = (estoqueDestino[0]?.quantidade_total || 0);
    const saldoDestinoNovo = saldoDestinoAnterior + quantidade;

    const movEntrada = await base44.entities.MovimentacaoEstoque.create({
      data: new Date().toISOString(),
      tipo: 'transf_entrada',
      insumo_id,
      codigo_insumo: insumo?.codigo || '',
      descricao_insumo: insumo?.nome || '',
      unidade: insumo?.unidade || '',
      quantidade,
      valor_unitario: custo_unitario,
      valor_total,
      obra_id: obra_destino_id,
      deposito_origem_id: obra_origem_id,
      deposito_destino_id: obra_destino_id,
      referencia_tipo: 'transferencia',
      referencia_id: movSaida.id, // vincula à saída
      usuario_id: user.email,
      observacao: `Recebimento de transferência da obra ${obra_origem_id}: ${observacao || ''}`,
      saldo_anterior: saldoDestinoAnterior,
      saldo_atual: saldoDestinoNovo,
      custo_medio_anterior: custo_unitario,
      custo_medio_atual: custo_unitario
    });

    // 3️⃣ Atualizar referência cruzada
    await base44.entities.MovimentacaoEstoque.update(movSaida.id, {
      referencia_id: movEntrada.id
    });

    // 4️⃣ Log de auditoria
    const transferencia = await base44.entities.TransferenciaEstoque.create({
      insumo_id,
      obra_origem_id,
      obra_destino_id,
      quantidade,
      custo_unitario,
      valor_total,
      status: 'concluida',
      data_transferencia: new Date().toISOString(),
      usuario_transferencia_email: user.email,
      mov_saida_id: movSaida.id,
      mov_entrada_id: movEntrada.id,
      observacao
    });

    await base44.entities.LogAuditoria.create({
      function_name: 'transferirEstoqueEntreObras',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ insumo_id, obra_origem_id, obra_destino_id, quantidade }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'transferencia_estoque_entre_obras',
        transferencia_id: transferencia.id,
        mov_saida_id: movSaida.id,
        mov_entrada_id: movEntrada.id,
        quantidade,
        valor_total
      }
    });

    return Response.json({
      success: true,
      message: 'Transferência concluída com sucesso',
      transferencia_id: transferencia.id,
      movimentacoes: {
        saida: movSaida.id,
        entrada: movEntrada.id
      },
      resumo: {
        insumo_id,
        quantidade_transferida: quantidade,
        valor_total,
        saldo_origem_anterior: saldoAtual,
        saldo_origem_novo: saldoAtual - quantidade,
        saldo_destino_anterior: saldoDestinoAnterior,
        saldo_destino_novo: saldoDestinoNovo
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao transferir estoque:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});