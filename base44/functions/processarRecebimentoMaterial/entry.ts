import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.ts';
import { logAuditoria } from './_lib/logAuditoria.ts';

/**
 * Processar Recebimento de Material
 * 
 * Fluxo CRÍTICO:
 * 1. Validar OC (aprovada, depósito existe)
 * 2. Validar quantidades (não receber > solicitado - tolerância 0%)
 * 3. Criar RecebimentoMaterial
 * 4. Para cada item: criar MovimentacaoEstoque tipo "entrada_compra"
 * 5. Atualizar SaldoEstoque via processarMovimentacaoEstoque
 * 6. Atualizar status OC (parcial/finalizada)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RBAC: almoxarife, compras e diretor podem processar recebimento
    const { user } = await requireRole(base44, ['diretor', 'almoxarife', 'compras']);

    const {
      ordem_compra_id,
      numero_oc,
      almoxarifado_id,
      itens,
      numero_nfe = '',
      data_nfe = '',
      observacoes = '',
      confirmacao_qualidade = true
    } = await req.json();

    // VALIDAÇÕES
    if (!ordem_compra_id || !almoxarifado_id || !itens || itens.length === 0) {
      return Response.json({
        error: 'Campos obrigatórios: ordem_compra_id, almoxarifado_id, itens'
      }, { status: 400 });
    }

    // Buscar OC
    const ocs = await base44.asServiceRole.entities.OrdemCompra.filter({ id: ordem_compra_id });
    const oc = ocs[0];
    
    if (!oc) {
      return Response.json({ error: 'OC não encontrada' }, { status: 404 });
    }

    if (oc.status !== 'aprovada') {
      return Response.json({
        error: 'OC precisa estar aprovada para receber material'
      }, { status: 422 });
    }

    // Validar almoxarifado existe
    const almoxs = await base44.asServiceRole.entities.Almoxarifado.filter({ id: almoxarifado_id });
    if (!almoxs || almoxs.length === 0) {
      return Response.json({ error: 'Depósito não encontrado' }, { status: 404 });
    }

    // VALIDAR QUANTIDADES (tolerância 0% - não receber acima do solicitado)
    for (let i = 0; i < itens.length; i++) {
      const itemRecebido = itens[i];
      const itemOC = oc.itens?.find(x => x.insumo_id === itemRecebido.insumo_id);
      
      if (!itemOC) continue;

      const totalJaRecebido = itemOC.quantidade_recebida || 0;
      const solicitado = itemOC.quantidade_solicitada || 0;
      const agoraRecebendo = itemRecebido.quantidade_recebida || 0;

      if ((totalJaRecebido + agoraRecebendo) > solicitado) {
        return Response.json({
          error: `Quantidade excede o solicitado no item "${itemOC.descricao}". Solicitado: ${solicitado}, Já recebido: ${totalJaRecebido}, Tentando receber: ${agoraRecebendo}`
        }, { status: 422 });
      }
    }

    // CRIAR RECEBIMENTO
    const recebimento = await base44.asServiceRole.entities.RecebimentoMaterial.create({
      ordem_compra_id,
      numero_oc,
      almoxarifado_id,
      fornecedor_id: oc.fornecedor_id,
      fornecedor_nome: oc.fornecedor_nome,
      itens: itens.map(i => ({
        insumo_id: i.insumo_id,
        descricao: i.descricao,
        quantidade_solicitada: i.quantidade_solicitada,
        quantidade_recebida: i.quantidade_recebida || 0,
        quantidade_rejeitada: i.quantidade_rejeitada || 0,
        divergencia: (i.quantidade_solicitada || 0) - (i.quantidade_recebida || 0),
        valor_unitario: i.valor_unitario
      })),
      data_recebimento: new Date().toISOString(),
      responsavel_almoxarife: user.email,
      numero_nfe,
      data_nfe,
      status_recebimento: 'parcial',
      observacoes,
      confirmacao_qualidade,
      data_armazenagem: new Date().toISOString()
    });

    // CRIAR MOVIMENTAÇÕES DE ESTOQUE (ENTRADA) - Chamada direta, não via invoke
    const movimentacoes = [];
    for (const item of itens) {
      if (!item.quantidade_recebida || item.quantidade_recebida <= 0) continue;

      // Criar movimentação diretamente com recebimento_id para rastreabilidade
      const mov = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
        tipo: 'entrada_compra',
        insumo_id: item.insumo_id,
        almoxarifado_destino_id: almoxarifado_id,
        quantidade: item.quantidade_recebida,
        custo_unitario: item.valor_unitario || 0,
        valor_total: item.quantidade_recebida * (item.valor_unitario || 0),
        data_movimentacao: new Date().toISOString().split('T')[0],
        ordem_compra_id,
        recebimento_id: recebimento.id,
        responsavel: user.email,
        observacoes: `Recebimento OC ${numero_oc} - NF ${numero_nfe || 'N/A'}`
      });

      // Atualizar SaldoEstoque
      const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({
        insumo_id: item.insumo_id,
        almoxarifado_id
      });

      let saldo = saldos?.[0];
      const insumos = await base44.asServiceRole.entities.Insumo.filter({ id: item.insumo_id });
      const insumo = insumos?.[0];

      if (!saldo) {
        // Criar novo saldo
        await base44.asServiceRole.entities.SaldoEstoque.create({
          insumo_id: item.insumo_id,
          almoxarifado_id,
          codigo_insumo: insumo?.codigo || '',
          descricao_insumo: insumo?.descricao || item.descricao,
          unidade: insumo?.unidade || item.unidade || 'un',
          quantidade_total: item.quantidade_recebida,
          quantidade_disponivel: item.quantidade_recebida,
          quantidade_reservada: 0,
          custo_unitario_medio: item.valor_unitario || 0,
          valor_total_estoque: item.quantidade_recebida * (item.valor_unitario || 0),
          data_ultima_movimentacao: new Date().toISOString()
        });
      } else {
        // Atualizar saldo existente com custo médio ponderado
        const qtdAtual = saldo.quantidade_total || 0;
        const custoAtual = saldo.custo_unitario_medio || 0;
        const novaQtd = qtdAtual + item.quantidade_recebida;
        const novoCusto = ((qtdAtual * custoAtual) + (item.quantidade_recebida * (item.valor_unitario || 0))) / novaQtd;

        await base44.asServiceRole.entities.SaldoEstoque.update(saldo.id, {
          quantidade_total: novaQtd,
          quantidade_disponivel: (saldo.quantidade_disponivel || 0) + item.quantidade_recebida,
          custo_unitario_medio: novoCusto,
          valor_total_estoque: novaQtd * novoCusto,
          data_ultima_movimentacao: new Date().toISOString()
        });
      }

      movimentacoes.push(mov.id);
    }

    // ATUALIZAR OC - quantidade_recebida
    const itensAtualizados = oc.itens?.map(itemOC => {
      const itemRecebido = itens.find(i => i.insumo_id === itemOC.insumo_id);
      if (!itemRecebido) return itemOC;

      return {
        ...itemOC,
        quantidade_recebida: (itemOC.quantidade_recebida || 0) + (itemRecebido.quantidade_recebida || 0)
      };
    });

    const totalRecebido = itensAtualizados?.reduce((s, i) => s + (i.quantidade_recebida || 0), 0) || 0;
    const totalSolicitado = itensAtualizados?.reduce((s, i) => s + (i.quantidade_solicitada || 0), 0) || 0;

    const status_entrega = totalRecebido >= totalSolicitado ? 'recebido_total' : 'recebido_parcial';
    const status = totalRecebido >= totalSolicitado ? 'finalizada' : 'aprovada';

    await base44.asServiceRole.entities.OrdemCompra.update(ordem_compra_id, {
      itens: itensAtualizados,
      status_entrega,
      status
    });

    // Atualizar status do recebimento
    await base44.asServiceRole.entities.RecebimentoMaterial.update(recebimento.id, {
      status_recebimento: status_entrega === 'recebido_total' ? 'total' : 'parcial'
    });

    // Auditoria (util central)
    await logAuditoria(base44, {
      entidade_tipo: 'RecebimentoMaterial',
      entidade_id: recebimento.id,
      acao: 'RECEIVE',
      resumo: `Recebimento OC ${numero_oc} - ${itens.length} itens - NF ${numero_nfe || 'N/A'}`,
      dados_novos: { 
        ordem_compra_id, 
        almoxarifado_id, 
        status_recebimento: status_entrega, 
        qtd_itens: itens.length,
        movimentacoes_criadas: movimentacoes.length 
      },
      user_email: user.email,
      role: user.cargo,
      origem: 'ui',
      modulo: 'compras'
    });

    return Response.json({
      ok: true,
      recebimento_id: recebimento.id,
      movimentacoes_criadas: movimentacoes.length,
      status_entrega,
      message: 'Recebimento processado com sucesso'
    });

  } catch (error) {
    console.error('[ERROR] processarRecebimentoMaterial:', error);
    return Response.json({
      error: error.message || 'Erro ao processar recebimento'
    }, { status: 500 });
  }
});