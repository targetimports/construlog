/**
 * recalcBMsFuture: Recalcula BMs posteriores após retificação
 * Atualiza qtd_anterior, vl_anterior, saldos de BMs futuras
 */

import Decimal from 'npm:decimal.js@10.4.3';

function TRUNC2(x) {
  if (x === null || x === undefined) return 0;
  const d = new Decimal(x);
  if (d.isZero()) return 0;
  const scaled = d.mul(100);
  const truncated = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return truncated.div(100).toNumber();
}

export async function recalcBMsFuture(base44, obraId, contratoVersaoId, bmAtualBm) {
  /**
   * bmAtualBm: última BM aprovada (a que será usada como base para futuras)
   * Recalcula todas as BMs posteriores excluindo a própria por id e RETIFICADAS.
   * Usa created_date como critério de ordenação temporal em vez de numero.
   */

  try {
    // Buscar todas as BMs da obra/versão
    const allBMs = await base44.asServiceRole.entities.BM.filter({
      obra_id: obraId,
      contrato_versao_id: contratoVersaoId,
    }) || [];

    // Critério seguro: exclui self por id, exclui RETIFICADA, usa created_date para "posterior"
    const bmAtualDate = bmAtualBm.created_date || bmAtualBm.data_inicio || '';
    const futureBMs = allBMs.filter(bm =>
      bm.id !== bmAtualBm.id &&
      bm.status !== 'RETIFICADA' &&
      // fallback: se created_date disponível usa data, senão usa numero (legado)
      (bmAtualDate
        ? (bm.created_date || bm.data_inicio || '') > bmAtualDate
        : bm.numero > bmAtualBm.numero)
    );

    if (futureBMs.length === 0) {
      return { updated: 0 };
    }

    // Buscar itens da BM atualizada
    const itemsAtual = await base44.asServiceRole.entities.BMItem.filter({
      bm_id: bmAtualBm.id,
    }) || [];

    let updated = 0;

    // Para cada BM futura
    for (const futuraBM of futureBMs) {
      const itemsFutura = await base44.asServiceRole.entities.BMItem.filter({
        bm_id: futuraBM.id,
      }) || [];

      // Atualizar cada item da futura
      for (const itemFutura of itemsFutura) {
        const itemAtual = itemsAtual.find(i => i.contrato_item_id === itemFutura.contrato_item_id);
        
        if (!itemAtual) continue;

        const novaQtdAnterior = itemAtual.qtd_acumulada || 0;
        const novaVlAnterior = itemAtual.vl_acumulado || 0;

        const qtdAcumulada = new Decimal(novaQtdAnterior).add(itemFutura.qtd_periodo_final || 0);
        const vlAcumulado = new Decimal(novaVlAnterior).add(itemFutura.vl_periodo || 0);

        // Buscar ContratoItem para pegar preco_total e qtd_contrato
        const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({
          id: itemFutura.contrato_item_id,
        }) || [];
        const contratoItem = contratoItems[0];

        if (!contratoItem) continue;

        const qtdSaldo = new Decimal(contratoItem.qtd_contrato || 0).sub(qtdAcumulada);
        const vlSaldo = new Decimal(contratoItem.preco_total || 0).sub(vlAcumulado);

        await base44.asServiceRole.entities.BMItem.update(itemFutura.id, {
          qtd_anterior: novaQtdAnterior,
          vl_anterior: novaVlAnterior,
          qtd_acumulada: TRUNC2(qtdAcumulada.toNumber()),
          vl_acumulado: TRUNC2(vlAcumulado.toNumber()),
          qtd_saldo: TRUNC2(qtdSaldo.toNumber()),
          vl_saldo: TRUNC2(vlSaldo.toNumber()),
        });

        updated++;
      }

      // Recalcular totais da BM futura
      const newItems = await base44.asServiceRole.entities.BMItem.filter({
        bm_id: futuraBM.id,
      }) || [];

      const newTotal = newItems.reduce((sum, it) => sum + (it.vl_acumulado || 0), 0);
      const newPercent = futuraBM.total_contrato > 0 
        ? (newTotal / futuraBM.total_contrato) * 100 
        : 0;

      await base44.asServiceRole.entities.BM.update(futuraBM.id, {
        total_anterior: bmAtualBm.total_acumulado || 0,
        total_acumulado: TRUNC2(newTotal),
        total_saldo: TRUNC2(new Decimal(futuraBM.total_contrato).sub(newTotal).toNumber()),
        percent_concluida: TRUNC2(newPercent),
      });
    }

    return { updated, futuras: futureBMs.length };

  } catch (error) {
    console.error('[recalcBMsFuture]', error?.message);
    throw error;
  }
}