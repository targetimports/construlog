import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { 
      itens,
      deposito_origem_id,
      obra_destino_id,
      observacao
    } = await req.json();

    // Validações
    if (!deposito_origem_id || !obra_destino_id || !itens || itens.length === 0) {
      return Response.json({ 
        error: 'Campos obrigatórios: deposito_origem_id, obra_destino_id, itens' 
      }, { status: 400 });
    }

    const movimentacoes = [];
    const erros = [];

    // Buscar depósito da obra (se não existe, criar)
    let depositosObra = await base44.entities.Almoxarifado.filter({
      obra_id: obra_destino_id,
      tipo: 'obra'
    });

    let depositoObraId;
    if (depositosObra.length === 0) {
      const obra = await base44.entities.Obra.get(obra_destino_id);
      const novoDeposito = await base44.asServiceRole.entities.Almoxarifado.create({
        nome: `Estoque - ${obra.nome}`,
        tipo: 'obra',
        obra_id: obra_destino_id
      });
      depositoObraId = novoDeposito.id;
    } else {
      depositoObraId = depositosObra[0].id;
    }

    // Processar cada item
    for (const item of itens) {
      try {
        const { insumo_id, quantidade } = item;

        if (!insumo_id || !quantidade || quantidade <= 0) {
          erros.push({ insumo_id, erro: 'Insumo ou quantidade inválida' });
          continue;
        }

        // Buscar saldo origem
        const saldosOrigem = await base44.entities.SaldoEstoque.filter({
          insumo_id,
          deposito_id: deposito_origem_id
        });

        if (saldosOrigem.length === 0 || saldosOrigem[0].quantidade < quantidade) {
          erros.push({ insumo_id, erro: 'Saldo insuficiente no estoque origem' });
          continue;
        }

        const saldoOrigem = saldosOrigem[0];
        const valorUnitario = saldoOrigem.custo_medio || 0;
        const valorTotal = quantidade * valorUnitario;

        // Criar movimentação de SAÍDA da origem
        const movSaida = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          data: new Date().toISOString(),
          tipo: 'saida_transferencia',
          insumo_id,
          quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal,
          deposito_origem_id,
          deposito_destino_id: depositoObraId,
          obra_id: obra_destino_id,
          referencia_tipo: 'transferencia',
          usuario_id: user.email,
          observacao,
          saldo_anterior: saldoOrigem.quantidade,
          saldo_atual: saldoOrigem.quantidade - quantidade,
          custo_medio_anterior: saldoOrigem.custo_medio,
          custo_medio_atual: saldoOrigem.custo_medio
        });

        // Atualizar saldo origem
        await base44.asServiceRole.entities.SaldoEstoque.update(saldoOrigem.id, {
          quantidade: saldoOrigem.quantidade - quantidade,
          ultima_movimentacao: new Date().toISOString()
        });

        // Criar movimentação de ENTRADA no destino
        const saldosDestino = await base44.entities.SaldoEstoque.filter({
          insumo_id,
          deposito_id: depositoObraId
        });

        const saldoDestino = saldosDestino[0] || { 
          quantidade: 0, 
          custo_medio: 0 
        };

        const novaQuantidadeDestino = saldoDestino.quantidade + quantidade;
        const valorTotalAnterior = saldoDestino.quantidade * saldoDestino.custo_medio;
        const novoCustoMedio = novaQuantidadeDestino > 0
          ? (valorTotalAnterior + valorTotal) / novaQuantidadeDestino
          : valorUnitario;

        const movEntrada = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          data: new Date().toISOString(),
          tipo: 'entrada',
          insumo_id,
          quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal,
          deposito_origem_id,
          deposito_destino_id: depositoObraId,
          obra_id: obra_destino_id,
          referencia_tipo: 'transferencia',
          referencia_id: movSaida.id,
          usuario_id: user.email,
          observacao,
          saldo_anterior: saldoDestino.quantidade,
          saldo_atual: novaQuantidadeDestino,
          custo_medio_anterior: saldoDestino.custo_medio,
          custo_medio_atual: novoCustoMedio
        });

        // Atualizar ou criar saldo destino
        if (saldosDestino[0]) {
          await base44.asServiceRole.entities.SaldoEstoque.update(saldosDestino[0].id, {
            quantidade: novaQuantidadeDestino,
            custo_medio: novoCustoMedio,
            ultima_movimentacao: new Date().toISOString()
          });
        } else {
          await base44.asServiceRole.entities.SaldoEstoque.create({
            insumo_id,
            deposito_id: depositoObraId,
            quantidade: novaQuantidadeDestino,
            custo_medio: novoCustoMedio,
            ultima_movimentacao: new Date().toISOString()
          });
        }

        movimentacoes.push({ saida: movSaida, entrada: movEntrada });

      } catch (error) {
        erros.push({ insumo_id: item.insumo_id, erro: error.message });
      }
    }

    return Response.json({
      success: true,
      total_itens: itens.length,
      processados: movimentacoes.length,
      erros: erros.length,
      movimentacoes,
      erros
    });

  } catch (error) {
    console.error('Erro ao transferir estoque:', error);
    return Response.json({ 
      error: error.message || 'Erro ao transferir estoque' 
    }, { status: 500 });
  }
});