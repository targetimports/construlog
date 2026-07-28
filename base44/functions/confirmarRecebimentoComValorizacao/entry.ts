import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar role do usuário (admin ou almoxarife)
    if (user.role !== 'admin') {
      const permissoes = await base44.asServiceRole.entities.PermissaoUsuario.filter({
        user_email: user.email
      });
      const temPermissao = permissoes?.some(p => p.permissoes?.includes('receber_material'));
      if (!temPermissao) {
        return Response.json({ error: 'Sem permissão para receber material' }, { status: 403 });
      }
    }

    const { recebimento_id, almoxarifado_id } = await req.json();

    if (!recebimento_id || !almoxarifado_id) {
      return Response.json({
        error: 'recebimento_id e almoxarifado_id são obrigatórios'
      }, { status: 400 });
    }

    // Buscar recebimento
    const recebimento = await base44.asServiceRole.entities.RecebimentoMaterial.read(recebimento_id);
    if (!recebimento) {
      return Response.json({ error: 'Recebimento não encontrado' }, { status: 404 });
    }

    // Buscar OC para valores
    const oc = await base44.asServiceRole.entities.OrdemCompra.read(recebimento.ordem_compra_id);
    if (!oc) {
      return Response.json({ error: 'Ordem de compra não encontrada' }, { status: 404 });
    }

    // Processar cada item do recebimento
    for (const itemRecebido of recebimento.itens) {
      const insumo = await base44.asServiceRole.entities.Insumo.read(itemRecebido.insumo_id);
      if (!insumo) continue;

      // Buscar item da OC para pegar preço real
      const itemOC = oc.itens.find(i => i.insumo_id === itemRecebido.insumo_id);
      if (!itemOC) continue;

      const custo_unitario = itemOC.valor_unitario || 0;
      const quantidade_recebida = itemRecebido.quantidade_recebida || 0;
      const valor_total = quantidade_recebida * custo_unitario;

      // 1. Criar MovimentacaoEstoque
      await base44.asServiceRole.entities.MovimentacaoEstoque.create({
        insumo_id: itemRecebido.insumo_id,
        tipo: 'entrada_compra',
        quantidade: quantidade_recebida,
        almoxarifado_destino_id: almoxarifado_id,
        ordem_compra_id: oc.id,
        recebimento_id: recebimento_id,
        custo_unitario,
        valor_total,
        data_movimentacao: new Date().toISOString().split('T')[0],
        responsavel: user.email,
        observacoes: `Recebimento ${recebimento.numero_oc} - NF ${recebimento.numero_nfe}`
      });

      // 2. Atualizar Insumo com preço real de compra
      await base44.asServiceRole.entities.Insumo.update(itemRecebido.insumo_id, {
        preco_ultima_compra: custo_unitario,
        status_precificacao: custo_unitario > 0 ? 'ok' : 'pendente',
        historico_precos: [
          ...(insumo.historico_precos || []),
          {
            preco: custo_unitario,
            data: new Date().toISOString().split('T')[0],
            usuario: user.email,
            tipo: 'compra'
          }
        ]
      });

      // 3. Buscar/atualizar SaldoEstoque
      const saldoExistente = await base44.asServiceRole.entities.SaldoEstoque.filter({
        insumo_id: itemRecebido.insumo_id,
        almoxarifado_id
      });

      if (saldoExistente && saldoExistente.length > 0) {
        const saldo = saldoExistente[0];
        const qtd_total = saldo.quantidade_total + quantidade_recebida;
        const valor_anterior = saldo.quantidade_total * (saldo.custo_unitario_medio || 0);
        const valor_novo = quantidade_recebida * custo_unitario;
        const custo_medio = (valor_anterior + valor_novo) / qtd_total;

        await base44.asServiceRole.entities.SaldoEstoque.update(saldo.id, {
          quantidade_total: qtd_total,
          quantidade_disponivel: qtd_total - (saldo.quantidade_reservada || 0),
          custo_unitario_medio: custo_medio,
          valor_total_estoque: qtd_total * custo_medio,
          data_ultima_movimentacao: new Date().toISOString()
        });
      } else {
        // Criar novo saldo
        await base44.asServiceRole.entities.SaldoEstoque.create({
          insumo_id: itemRecebido.insumo_id,
          almoxarifado_id,
          codigo_insumo: insumo.codigo,
          descricao_insumo: insumo.descricao,
          unidade: insumo.unidade,
          quantidade_total: quantidade_recebida,
          quantidade_disponivel: quantidade_recebida,
          custo_unitario_medio: custo_unitario,
          valor_total_estoque: valor_total,
          data_ultima_movimentacao: new Date().toISOString()
        });
      }
    }

    return Response.json({
      success: true,
      recebimento_id,
      mensagem: 'Recebimento confirmado e estoque valorizado pelo preço real da compra'
    });
  } catch (error) {
    console.error('Erro ao confirmar recebimento:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});