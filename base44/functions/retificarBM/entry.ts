/**
 * retificarBM: Motor de retificação
 * 
 * Cria novo BM (RASCUNHO) vinculado à original
 * Marca original como RETIFICADA
 * Recalcula cascata de BMs futuras
 * Registra auditoria
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { recalcBMsFuture } from './_lib/recalcBMsFuture';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try {
      payload = await req.json();
    } catch (e) {
      // Safe JSON
    }

    const { bm_id, motivo_retificacao } = payload;
    if (!bm_id) {
      return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });
    }

    // Buscar BM original
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bmOriginal = bms[0];
    if (!bmOriginal) {
      return Response.json({ error: 'BM não encontrada' }, { status: 404 });
    }

    if (bmOriginal.status !== 'APROVADA') {
      return Response.json({ 
        error: 'Apenas BMs APROVADAS podem ser retificadas' 
      }, { status: 400 });
    }

    // Buscar itens da BM original
    const itemsOriginal = await base44.asServiceRole.entities.BMItem.filter({
      bm_id: bmOriginal.id,
    }) || [];

    // Gerar número da nova BM
    const allBMs = await base44.asServiceRole.entities.BM.filter({
      obra_id: bmOriginal.obra_id,
      contrato_versao_id: bmOriginal.contrato_versao_id,
    }) || [];
    const maxNum = Math.max(...allBMs.map(b => b.numero || 0));
    const novoNumero = maxNum + 1;

    // Criar nova BM como RASCUNHO
    const novaBM = await base44.asServiceRole.entities.BM.create({
      obra_id: bmOriginal.obra_id,
      contrato_versao_id: bmOriginal.contrato_versao_id,
      numero: novoNumero,
      data_inicio: bmOriginal.data_inicio,
      data_fim: bmOriginal.data_fim,
      status: 'RASCUNHO',
      total_contrato: bmOriginal.total_contrato,
      total_anterior: bmOriginal.total_anterior,
      total_periodo: 0,
      total_acumulado: 0,
      total_saldo: bmOriginal.total_contrato,
      percent_concluida: 0,
      retifica_bm_id: bmOriginal.id, // vincula à original
    });

    // Copiar itens da original para nova BM
    for (const item of itemsOriginal) {
      await base44.asServiceRole.entities.BMItem.create({
        bm_id: novaBM.id,
        contrato_item_id: item.contrato_item_id,
        qtd_periodo_input: 0,
        override_manual: false,
        qtd_anterior: item.qtd_anterior,
        qtd_periodo_final: 0,
        qtd_acumulada: item.qtd_anterior,
        qtd_saldo: item.qtd_saldo,
        vl_anterior: item.vl_anterior,
        vl_periodo: 0,
        vl_acumulado: item.vl_anterior,
        vl_saldo: item.vl_saldo,
      });
    }

    // Marcar original como RETIFICADA
    await base44.asServiceRole.entities.BM.update(bmOriginal.id, {
      status: 'RETIFICADA',
      retificada_por_id: novaBM.id,
    });

    // Registrar auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      obra_id: bmOriginal.obra_id,
      entidade: 'BM',
      entidade_id: bmOriginal.id,
      acao: 'rectify',
      usuario_id: user.email,
      observacao: motivo_retificacao || 'Sem motivo especificado',
      dados_antes: {
        status: bmOriginal.status,
      },
      dados_depois: {
        status: 'RETIFICADA',
        retificada_por_id: novaBM.id,
      },
    });

    // Recalcular cascata de BMs futuras
    const cascataResult = await recalcBMsFuture(
      base44,
      bmOriginal.obra_id,
      bmOriginal.contrato_versao_id,
      bmOriginal // usar original como referência
    );

    return Response.json({
      success: true,
      bm_original_id: bmOriginal.id,
      bm_nova_id: novaBM.id,
      numero_novo: novoNumero,
      cascata_atualizada: cascataResult,
    });

  } catch (error) {
    console.error('[retificarBM]', error?.message);
    return Response.json({ 
      error: error?.message || 'Erro ao retificar BM' 
    }, { status: 500 });
  }
});