/**
 * onBMApproveWithFinance: Orquestrador de aprovação com integração financeira
 * 
 * Fluxo:
 * 1. Validar BM (status, saldo, etc)
 * 2. Criar ContaReceber (se configurado)
 * 3. Marcar BM como APROVADA
 * 4. Registrar auditoria
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bm_id, observacao_auditoria } = await req.json();
    if (!bm_id) {
      return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });
    }

    // Buscar BM
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    if (bm.status !== 'RASCUNHO') {
      return Response.json({
        error: 'BM deve estar em RASCUNHO para aprovar'
      }, { status: 400 });
    }

    // GUARD: não aprovar BM sem itens
    const bmItems = await base44.asServiceRole.entities.BMItem.filter({ bm_id }) || [];
    console.log(`[onBMApproveWithFinance] GUARD: bm_id=${bm_id} obra_id=${bm.obra_id} contrato_versao_id=${bm.contrato_versao_id} bmItems=${bmItems.length}`);
    if (bmItems.length === 0) {
      return Response.json({
        code: 'BM_SEM_ITENS',
        error: 'Não é possível aprovar uma BM sem itens de medição.'
      }, { status: 400 });
    }

    // ── BM_AUDIT ──
    const auditContratoItens = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id: bm.contrato_versao_id }) || [];
    console.log(JSON.stringify({
      tag: 'BM_AUDIT',
      fn: 'onBMApproveWithFinance',
      bm_id,
      obra_id: bm.obra_id,
      contrato_versao_id: bm.contrato_versao_id,
      qtd_contrato_itens: auditContratoItens.length,
      qtd_bm_items: bmItems.length,
      total_contrato: bm.total_contrato,
      total_periodo: bm.total_periodo,
      total_acumulado: bm.total_acumulado,
      percent_concluida: bm.percent_concluida,
      sample_contrato_item: auditContratoItens[0] ? {
        id: auditContratoItens[0].id,
        unidade: auditContratoItens[0].unidade,
        qtd_contrato: auditContratoItens[0].qtd_contrato,
        preco_unit_com_bdi: auditContratoItens[0].preco_unit_com_bdi,
        preco_total: auditContratoItens[0].preco_total
      } : null,
      sample_bm_item: bmItems[0] ? {
        id: bmItems[0].id,
        contrato_item_id: bmItems[0].contrato_item_id,
        qtd_periodo_input: bmItems[0].qtd_periodo_input,
        qtd_periodo_final: bmItems[0].qtd_periodo_final,
        vl_periodo: bmItems[0].vl_periodo,
        vl_acumulado: bmItems[0].vl_acumulado
      } : null
    }));

    // Validação: saldo negativo global
    if (bm.total_saldo < 0) {
      return Response.json({
        error: 'Não é possível aprovar: saldo negativo detectado'
      }, { status: 400 });
    }

    // Validação: saldo negativo por item individual
    const itensComSaldoNegativo = bmItems.filter(it => (it.qtd_saldo ?? 0) < -0.0001);
    if (itensComSaldoNegativo.length > 0) {
      const detalhe = itensComSaldoNegativo.map(it => `BMItem ${it.id}: saldo_qtd=${it.qtd_saldo}`).join('; ');
      console.warn(`[onBMApproveWithFinance] BLOQUEIO: ${itensComSaldoNegativo.length} itens com saldo negativo. ${detalhe}`);
      return Response.json({
        error: `Não é possível aprovar: ${itensComSaldoNegativo.length} item(s) com quantidade medida acima do contratado. Corrija antes de aprovar.`,
        itens_com_problema: itensComSaldoNegativo.map(it => ({
          id: it.id,
          contrato_item_id: it.contrato_item_id,
          qtd_saldo: it.qtd_saldo
        }))
      }, { status: 400 });
    }

    // Passo 1: Gerar ContaReceber (se habilitado)
    let contaReceberResult = { conta_receber_id: null };
    try {
      const crResult = await base44.functions.invoke('gerarContaReceberDeMedicao', {
        bm_id
      });
      contaReceberResult = crResult.data;
    } catch (e) {
      console.warn('[onBMApproveWithFinance] Erro ao gerar ContaReceber:', e.message);
      // Não bloqueia aprovação se falhar
    }

    // Passo 2: Marcar BM como APROVADA
    await base44.asServiceRole.entities.BM.update(bm.id, {
      status: 'APROVADA'
    });

    // Passo 3: Registrar auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      obra_id: bm.obra_id,
      entidade: 'BM',
      entidade_id: bm.id,
      acao: 'approve',
      usuario_id: user.email,
      observacao: observacao_auditoria || `BM #${bm.numero} aprovada com integração financeira`,
      dados_depois: {
        status: 'APROVADA',
        conta_receber_id: contaReceberResult.conta_receber_id,
        total_periodo: bm.total_periodo,
        total_acumulado: bm.total_acumulado
      }
    });

    return Response.json({
      success: true,
      bm_id,
      status_novo: 'APROVADA',
      conta_receber_id: contaReceberResult.conta_receber_id,
      conta_receber_valor: contaReceberResult.valor_liquido,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[onBMApproveWithFinance]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao aprovar BM'
    }, { status: 500 });
  }
});