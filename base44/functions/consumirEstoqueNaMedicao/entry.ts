import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { 
      medicao_id,
      itens_consumo
    } = await req.json();

    if (!medicao_id || !itens_consumo || itens_consumo.length === 0) {
      return Response.json({ 
        error: 'Campos obrigatórios: medicao_id, itens_consumo' 
      }, { status: 400 });
    }

    // Buscar medição
    const medicao = await base44.entities.Medicao.get(medicao_id);
    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    const obra_id = medicao.obra_id;
    if (!obra_id) {
      return Response.json({ error: 'Medição sem obra vinculada' }, { status: 400 });
    }

    // Buscar depósito da obra
    const depositosObra = await base44.entities.Almoxarifado.filter({
      obra_id,
      tipo: 'obra'
    });

    if (depositosObra.length === 0) {
      return Response.json({ 
        error: 'Obra não possui depósito de estoque' 
      }, { status: 400 });
    }

    const depositoObraId = depositosObra[0].id;
    const movimentacoes = [];
    const erros = [];

    // Processar cada item de consumo
    for (const item of itens_consumo) {
      try {
        const { insumo_id, quantidade, centro_custo_id } = item;

        if (!insumo_id || !quantidade || quantidade <= 0 || !centro_custo_id) {
          erros.push({ 
            insumo_id, 
            erro: 'Dados incompletos: necessário insumo_id, quantidade e centro_custo_id' 
          });
          continue;
        }

        // Buscar saldo
        const saldos = await base44.entities.SaldoEstoque.filter({
          insumo_id,
          deposito_id: depositoObraId
        });

        if (saldos.length === 0 || saldos[0].quantidade < quantidade) {
          erros.push({ 
            insumo_id, 
            erro: 'Saldo insuficiente no estoque da obra' 
          });
          continue;
        }

        const saldo = saldos[0];
        const valorUnitario = saldo.custo_medio || 0;
        const valorTotal = quantidade * valorUnitario;

        // Criar movimentação de CONSUMO
        const movimentacao = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          data: new Date().toISOString(),
          tipo: 'saida_consumo',
          insumo_id,
          quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotal,
          deposito_origem_id: depositoObraId,
          obra_id,
          centro_custo_id,
          referencia_tipo: 'medicao',
          referencia_id: medicao_id,
          usuario_id: user.email,
          observacao: `Consumo referente à medição ${medicao.numero || medicao_id}`,
          saldo_anterior: saldo.quantidade,
          saldo_atual: saldo.quantidade - quantidade,
          custo_medio_anterior: saldo.custo_medio,
          custo_medio_atual: saldo.custo_medio
        });

        // Atualizar saldo
        await base44.asServiceRole.entities.SaldoEstoque.update(saldo.id, {
          quantidade: saldo.quantidade - quantidade,
          ultima_movimentacao: new Date().toISOString()
        });

        movimentacoes.push(movimentacao);

      } catch (error) {
        erros.push({ insumo_id: item.insumo_id, erro: error.message });
      }
    }

    return Response.json({
      success: true,
      medicao_id,
      obra_id,
      total_itens: itens_consumo.length,
      processados: movimentacoes.length,
      erros: erros.length,
      valor_total_consumido: movimentacoes.reduce((sum, m) => sum + m.valor_total, 0),
      movimentacoes,
      erros
    });

  } catch (error) {
    console.error('Erro ao consumir estoque:', error);
    return Response.json({ 
      error: error.message || 'Erro ao consumir estoque' 
    }, { status: 500 });
  }
});