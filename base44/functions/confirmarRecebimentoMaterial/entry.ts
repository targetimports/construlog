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
      oc_id,
      itens_recebidos,
      almoxarifado_id,
      numero_nfe,
      data_nfe,
      observacoes
    } = body;

    if (!oc_id || !itens_recebidos || !almoxarifado_id) {
      return Response.json({ 
        error: 'oc_id, itens_recebidos e almoxarifado_id são obrigatórios' 
      }, { status: 400 });
    }

    const oc = await base44.entities.OrdemCompra.get(oc_id);
    if (!oc) {
      return Response.json({ error: 'Ordem de compra não encontrada' }, { status: 404 });
    }

    // Criar registro de recebimento
    const recebimento = await base44.entities.RecebimentoMaterial.create({
      ordem_compra_id: oc_id,
      numero_oc: oc.numero,
      almoxarifado_id,
      fornecedor_id: oc.fornecedor_id,
      fornecedor_nome: oc.fornecedor_nome,
      itens: itens_recebidos.map(item => ({
        ...item,
        divergencia: (item.quantidade_recebida || 0) - (item.quantidade_solicitada || 0)
      })),
      data_recebimento: new Date().toISOString(),
      responsavel_almoxarife: user.email,
      numero_nfe,
      data_nfe,
      status_recebimento: 'total',
      observacoes
    });

    // Atualizar status da OC
    const tem_divergencia = itens_recebidos.some(i => (i.quantidade_recebida || 0) !== (i.quantidade_solicitada || 0));
    
    await base44.entities.OrdemCompra.update(oc_id, {
      status: 'recebida',
      status_entrega: 'recebido_total'
    });

    // Dar entrada no estoque central
    const saldos = [];
    for (const item of itens_recebidos) {
      const saldo = await base44.entities.SaldoEstoque.filter({
        insumo_id: item.insumo_id,
        almoxarifado_id
      });

      if (saldo.length > 0) {
        // Atualizar saldo existente
        const novo_total = (saldo[0].quantidade_total || 0) + (item.quantidade_recebida || 0);
        await base44.entities.SaldoEstoque.update(saldo[0].id, {
          quantidade_total: novo_total,
          quantidade_disponivel: novo_total - (saldo[0].quantidade_reservada || 0),
          data_ultima_movimentacao: new Date().toISOString()
        });
      } else {
        // Criar novo saldo
        const insumo = await base44.entities.Insumo.get(item.insumo_id);
        await base44.entities.SaldoEstoque.create({
          insumo_id: item.insumo_id,
          almoxarifado_id,
          codigo_insumo: insumo?.codigo || '',
          descricao_insumo: insumo?.descricao || '',
          unidade: insumo?.unidade || '',
          quantidade_total: item.quantidade_recebida || 0,
          quantidade_disponivel: item.quantidade_recebida || 0,
          custo_unitario_medio: item.valor_unitario || 0,
          valor_total_estoque: (item.quantidade_recebida || 0) * (item.valor_unitario || 0),
          data_ultima_movimentacao: new Date().toISOString()
        });
      }

      saldos.push({
        insumo_id: item.insumo_id,
        quantidade_recebida: item.quantidade_recebida
      });
    }

    // Registrar movimentação no estoque
    await base44.entities.MovimentacaoEstoque.create({
      insumo_id: itens_recebidos[0].insumo_id,
      tipo: 'entrada',
      quantidade: itens_recebidos.reduce((sum, i) => sum + (i.quantidade_recebida || 0), 0),
      almoxarifado_destino_id: almoxarifado_id,
      ordem_compra_id: oc_id,
      data_movimentacao: new Date().toISOString().split('T')[0],
      responsavel: user.email,
      observacoes: `Recebimento OC ${oc.numero}`
    });

    // Alertar se houver divergência
    if (tem_divergencia) {
      await base44.entities.AlertaInsumoOrcamento.create({
        tipo_alerta: 'material_recebido_e_nao_distribuido',
        severidade: 'aviso',
        mensagem: `Divergência detectada no recebimento da OC ${oc.numero}`,
        dados_alerta: {
          oc_numero: oc.numero,
          itens_com_divergencia: itens_recebidos.filter(i => i.divergencia !== 0).length
        }
      });
    }

    return Response.json({
      recebimento_id: recebimento.id,
      oc_id,
      status: 'recebido',
      quantidade_total_recebida: itens_recebidos.reduce((sum, i) => sum + (i.quantidade_recebida || 0), 0),
      tem_divergencia,
      observacao: tem_divergencia ? 'Verifique as divergências registradas' : 'Material entrando no estoque central'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});