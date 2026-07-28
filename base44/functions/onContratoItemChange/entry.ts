import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { trunc2 } from './_lib/calcUtils.js';

/**
 * Automação de entidade: dispara quando ContratoItem é criado ou atualizado.
 * Recalcula preco_total do item e total_contrato da ContratoVersao.
 *
 * Campos que ativam o recálculo: qtd_contrato, preco_unit_com_bdi, bdi_percent
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data } = payload;

    // Só processa create e update
    if (!['create', 'update'].includes(event?.type)) {
      return Response.json({ skipped: true });
    }

    // Para update: verificar se algum campo relevante mudou
    if (event.type === 'update' && old_data) {
      const camposRelevantes = ['qtd_contrato', 'preco_unit_com_bdi', 'bdi_percent'];
      const mudou = camposRelevantes.some(campo => old_data[campo] !== data[campo]);
      if (!mudou) {
        return Response.json({ skipped: true, reason: 'Nenhum campo relevante alterado' });
      }
    }

    const item = data;
    if (!item || !item.contrato_versao_id) {
      return Response.json({ skipped: true, reason: 'Sem contrato_versao_id' });
    }

    // 1. Recalcular e salvar preco_total do item que mudou
    const novo_preco_total = trunc2((item.qtd_contrato ?? 0) * (item.preco_unit_com_bdi ?? 0));
    if (item.preco_total !== novo_preco_total) {
      await base44.asServiceRole.entities.ContratoItem.update(item.id, { preco_total: novo_preco_total });
    }

    // 2. Buscar todos os itens para somar o total do contrato
    const todosItens = await base44.asServiceRole.entities.ContratoItem.filter({
      contrato_versao_id: item.contrato_versao_id
    });

    // Usar preco_total recém-calculado para o item atual, e o valor persistido para os demais
    let total_contrato = 0;
    for (const i of todosItens) {
      if (i.id === item.id) {
        total_contrato += novo_preco_total;
      } else {
        total_contrato += i.preco_total ?? 0;
      }
    }

    const total_final = trunc2(total_contrato);
    await base44.asServiceRole.entities.ContratoVersao.update(item.contrato_versao_id, {
      total_contrato: total_final
    });

    return Response.json({
      success: true,
      contrato_versao_id: item.contrato_versao_id,
      total_contrato: total_final,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});