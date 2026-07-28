/**
 * calcUtils.js — Utilitário central de cálculo para BM e Aditivo.
 *
 * Regras:
 * - Valores financeiros: sempre trunc2() no resultado final.
 * - Quantidades: manter 6 casas decimais (sem truncar aqui).
 * - safeDiv: retorna 0 quando divisor é zero.
 * - clamp: limita valor entre min e max.
 */

/**
 * Trunca para 2 casas decimais em direção a zero (equivalente ao TRUNC do Excel).
 * x >= 0 : Math.floor(x * 100) / 100
 * x <  0 : Math.ceil(x * 100) / 100
 *
 * @param {number} x
 * @returns {number}
 */
export function trunc2(x) {
  if (typeof x !== 'number' || !isFinite(x)) return 0;
  if (x >= 0) return Math.floor(x * 100) / 100;
  return Math.ceil(x * 100) / 100;
}

/**
 * Limita x ao intervalo [min, max].
 *
 * @param {number} x
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(x, min, max) {
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

/**
 * Divisão segura: retorna 0 se b === 0.
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function safeDiv(a, b) {
  if (b === 0 || !isFinite(b)) return 0;
  return a / b;
}

/**
 * Calcula os campos financeiros de um BMItem dado o preço unitário com BDI.
 * Todos os valores financeiros passam por trunc2().
 *
 * @param {object} p
 * @param {number} p.qtd_periodo_final  — quantidade final do período (6 casas)
 * @param {number} p.qtd_anterior       — quantidade acumulada anterior (6 casas)
 * @param {number} p.qtd_contrato       — quantidade contratada (6 casas)
 * @param {number} p.preco_total        — preço total do item (= qtd_contrato × preco_unit_com_bdi)
 * @param {number} p.preco_unit_com_bdi — preço unitário com BDI (6 casas)
 * @returns {{ qtd_acumulada, qtd_saldo, vl_anterior, vl_periodo, vl_acumulado, vl_saldo }}
 */
export function calcBMItemFinanceiro({ qtd_periodo_final, qtd_anterior, qtd_contrato, preco_total, preco_unit_com_bdi }) {
  const qtd_acumulada = qtd_anterior + qtd_periodo_final;
  const qtd_saldo = qtd_contrato - qtd_acumulada;

  const vl_anterior  = trunc2(qtd_anterior      * preco_unit_com_bdi);
  const vl_periodo   = trunc2(qtd_periodo_final  * preco_unit_com_bdi);
  const vl_acumulado = trunc2(qtd_acumulada      * preco_unit_com_bdi);
  const vl_saldo     = trunc2(preco_total        - vl_acumulado);

  return { qtd_acumulada, qtd_saldo, vl_anterior, vl_periodo, vl_acumulado, vl_saldo };
}

/**
 * Calcula os totais de cabeçalho de um BM a partir dos seus BMItems.
 * Todos os valores financeiros passam por trunc2().
 *
 * @param {number} total_contrato — valor total do contrato na data do BM
 * @param {number} total_anterior — acumulado até o BM anterior
 * @param {number} total_periodo  — soma de vl_periodo dos BMItems deste BM
 * @returns {{ total_acumulado, total_saldo, percent_concluida }}
 */
export function calcBMTotais({ total_contrato, total_anterior, total_periodo }) {
  const total_acumulado   = trunc2(total_anterior + total_periodo);
  const total_saldo       = trunc2(total_contrato - total_acumulado);
  const percent_concluida = trunc2(safeDiv(total_acumulado, total_contrato) * 100);

  return { total_acumulado, total_saldo, percent_concluida };
}

/**
 * Calcula os campos financeiros de um AditivoItem.
 * Todos os valores financeiros passam por trunc2().
 *
 * @param {object} p
 * @param {number} p.qtd_base             — quantidade base antes do aditivo
 * @param {number} p.acrescimo_qtd_final  — quantidade de acréscimo final
 * @param {number} p.supressao_qtd_final  — quantidade de supressão final
 * @param {number} p.preco_unit_com_bdi   — preço unitário com BDI
 * @returns {{ qtd_consolidada, acrescimo_valor, supressao_valor, valor_consolidado }}
 */
export function calcAditivoItemFinanceiro({ qtd_base, acrescimo_qtd_final, supressao_qtd_final, preco_unit_com_bdi }) {
  const qtd_consolidada   = qtd_base + acrescimo_qtd_final - supressao_qtd_final;
  const acrescimo_valor   = trunc2(acrescimo_qtd_final * preco_unit_com_bdi);
  const supressao_valor   = trunc2(supressao_qtd_final * preco_unit_com_bdi);
  const valor_consolidado = trunc2(qtd_consolidada     * preco_unit_com_bdi);

  return { qtd_consolidada, acrescimo_valor, supressao_valor, valor_consolidado };
}

/**
 * Calcula os totais de cabeçalho de um Aditivo a partir dos seus AditivoItems.
 * Todos os valores financeiros passam por trunc2().
 *
 * @param {Array<{ acrescimo_valor: number, supressao_valor: number }>} itens
 * @returns {{ total_acrescimo, total_supressao, total_liquido }}
 */
export function calcAditivoTotais(itens) {
  let total_acrescimo = 0;
  let total_supressao = 0;

  for (const item of itens) {
    total_acrescimo += item.acrescimo_valor ?? 0;
    total_supressao += item.supressao_valor ?? 0;
  }

  return {
    total_acrescimo: trunc2(total_acrescimo),
    total_supressao: trunc2(total_supressao),
    total_liquido:   trunc2(total_acrescimo - total_supressao),
  };
}