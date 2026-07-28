/**
 * calcBMService.js — Serviço central de cálculo de BM
 *
 * Motor oficial de cálculo para medições.
 * Reutilizável em múltiplos contextos (preview, salvamento, etc.)
 *
 * REGRAS DE PRECISÃO:
 *   - TRUNC2 → somente em valores monetários (vl_*) e totais/percentuais
 *   - Quantidades → precisão natural (sem TRUNC2)
 */

import { TRUNC2 } from './precision.js';

// Helper: normalizar códigos de item para comparação segura
const normCodigo = (x) => String(x ?? '').trim();

/**
 * selfTestTRUNC2 — valida TRUNC2 e lógica de dependência
 * Chamada somente quando params.test === true
 */
function selfTestTRUNC2() {
  const casos = [
    { entrada: 10.239,  esperado: 10.23  },
    { entrada: 10.235,  esperado: 10.23  },
    { entrada: -10.239, esperado: -10.23 },
    { entrada: -10.235, esperado: -10.23 },
  ];
  const resultados = casos.map(c => ({
    entrada:  c.entrada,
    esperado: c.esperado,
    obtido:   TRUNC2(c.entrada),
    passou:   TRUNC2(c.entrada) === c.esperado
  }));

  // Lógica de dependência: source 2.3 qtd=10, fator=2.9, target 2.4 qtd_contrato=20, qtd_anterior=0
  const qtd_source = 10, fator = 2.9, qtd_contrato_target = 20, qtd_anterior_target = 0;
  const sugerido = qtd_source * fator; // 29
  const saldo_antes = qtd_contrato_target - qtd_anterior_target; // 20
  const final = saldo_antes <= 0 ? 0 : Math.min(sugerido, saldo_antes); // 20

  return {
    trunc2: resultados,
    dependencia: { sugerido, saldo_antes, final, esperado: 20, passou: final === 20 }
  };
}

/**
 * calcBMCompleto: Calcula BM completa com todos os itens
 *
 * @param {object} params
 *   - obra_id (string): ID da obra
 *   - contrato_versao_id (string): ID da versão do contrato
 *   - bm_id (string, opcional): ID da BM corrente (excluída do anterior)
 *   - itens_input (array): [{ contrato_item_id, qtd_periodo_input, override_manual? }]
 *   - run_self_test (bool, opcional): se true, inclui self_test no debug
 * @param {object} base44 SDK initialized
 * @returns {object} { ok, bm_calculada, itens_calculados, debug, erro? }
 */
export async function calcBMCompleto(params, base44) {
  try {
    const { obra_id, contrato_versao_id, bm_id, itens_input = [], run_self_test = false, test = false } = params;

    if (!obra_id || !contrato_versao_id) {
      return { ok: false, erro: 'obra_id e contrato_versao_id são obrigatórios' };
    }

    // ─── Buscar ContratoVersao ────────────────────────────────────────────────
    const contratoVersoes = await base44.asServiceRole.entities.ContratoVersao.filter({ id: contrato_versao_id }) || [];
    const contratoVersao = contratoVersoes[0];
    if (!contratoVersao) {
      return { ok: false, erro: 'ContratoVersao não encontrada' };
    }

    // ─── Buscar ContratoItems da versão ───────────────────────────────────────
    const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id }) || [];

    // ─── Buscar BMs APROVADAS ANTERIORES (exclui a BM corrente se existir) ───
    const todasBMsAprovadas = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      contrato_versao_id,
      status: 'APROVADA'
    }) || [];
    // Excluir a própria BM por id (seguro mesmo se numero for instável)
    // e garantir filtro duplo: status === 'APROVADA' (já filtrado na query, aqui é redundância segura)
    const bmsAnteriores = bm_id
      ? todasBMsAprovadas.filter(b => b.id !== bm_id && b.status === 'APROVADA')
      : todasBMsAprovadas.filter(b => b.status === 'APROVADA');

    // Debug: rastrear origem do qtd_anterior (preenchido no loop abaixo)
    const _debugQtdAnteriorItens = {};

    // ─── Mapa de inputs por contrato_item_id ─────────────────────────────────
    const inputMap = Object.fromEntries(
      itens_input.map(i => [i.contrato_item_id, i])
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 1 — Cálculo base de todos os itens
    // ═══════════════════════════════════════════════════════════════════════════
    const itens_calculados = [];

    for (const item of contratoItems) {
      const input = inputMap[item.id] || {};
      const qtd_periodo_input = Number(input.qtd_periodo_input) || 0;
      const override_manual   = input.override_manual === true;

      // qtd_anterior = soma de qtd_periodo_final das BMs aprovadas anteriores
      let qtd_anterior = 0;
      const _somasPorBM = [];
      for (const bm of bmsAnteriores) {
        // Filtro por bm_id + contrato_item_id garante escopo correto (obra_id e contrato_versao_id
        // já estão garantidos pela origem de bmsAnteriores, filtrada por obra_id + contrato_versao_id + APROVADA)
        const bmItems = await base44.asServiceRole.entities.BMItem.filter({
          bm_id: bm.id,
          contrato_item_id: item.id
        }) || [];
        let somaItem = 0;
        for (const bi of bmItems) {
          somaItem += Number(bi.qtd_periodo_final) || 0;
        }
        qtd_anterior += somaItem;
        _somasPorBM.push({ bm_id: bm.id, bm_numero: bm.numero, soma: somaItem });
      }
      _debugQtdAnteriorItens[normCodigo(item.item_codigo)] = _somasPorBM;

      // Quantidades — sem TRUNC2 (precisão natural)
      const qtd_contrato    = Number(item.qtd_contrato) || 0;
      const qtd_periodo_final = qtd_periodo_input;
      const qtd_acumulada   = qtd_anterior + qtd_periodo_final;
      const qtd_saldo       = qtd_contrato - qtd_acumulada;

      // Valores — com TRUNC2
      const preco      = Number(item.preco_unit_com_bdi) || 0;
      const vl_anterior  = TRUNC2(qtd_anterior * preco);
      const vl_periodo   = TRUNC2(qtd_periodo_final * preco);
      const vl_acumulado = TRUNC2(qtd_acumulada * preco);
      const vl_saldo     = TRUNC2(qtd_saldo * preco);

      itens_calculados.push({
        contrato_item_id: item.id,
        item_codigo:      normCodigo(item.item_codigo),
        item_label:       item.item_label,
        descricao:        item.descricao,
        unidade:          item.unidade,
        qtd_contrato,
        preco_unit_com_bdi: preco,
        qtd_periodo_input,
        override_manual,
        qtd_anterior,
        qtd_periodo_final,
        qtd_acumulada,
        qtd_saldo,
        vl_anterior,
        vl_periodo,
        vl_acumulado,
        vl_saldo
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 2 — Buscar regras BM_PERIODO e preparar mapas
    // ═══════════════════════════════════════════════════════════════════════════
    const debug = {
      bm_id_atual: bm_id || null,
      regras_encontradas: [],   // preenchido abaixo com objetos {source,target,fator,aplicar_teto_saldo}
      dependencias_aplicadas: [],
      dependencias_puladas: [],
      anterior: {
        bms_consideradas_ids: bmsAnteriores.map(b => b.id),
        por_item: {}  // { [codigo]: soma_qtd } — preenchido no loop do passo 1
      },
      ...(run_self_test || test ? { self_test: selfTestTRUNC2() } : {})
    };

    // Preencher debug.anterior.por_item a partir do _debugQtdAnteriorItens já coletado
    for (const [codigo, somasPorBM] of Object.entries(_debugQtdAnteriorItens)) {
      debug.anterior.por_item[codigo] = somasPorBM.reduce((acc, s) => acc + s.soma, 0);
    }

    const regras = await base44.asServiceRole.entities.RegraDependenciaItem.filter({
      contrato_versao_id,
      tipo: 'BM_PERIODO'
    }) || [];

    // Preencher debug.regras_encontradas com shape completo
    debug.regras_encontradas = regras.map(r => ({
      source: normCodigo(r.source_codigo),
      target: normCodigo(r.target_codigo),
      fator:  Number(r.fator) || 0,
      aplicar_teto_saldo: r.aplicar_teto_saldo !== false
    }));

    if (regras.length > 0) {
      // Mapa mutável: normCodigo(item_codigo) → itemCalculado (referência viva)
      const calcByCodigo = {};
      for (const ic of itens_calculados) {
        calcByCodigo[normCodigo(ic.item_codigo)] = ic;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PASSO 3 — Cascata: máx 5 iterações, para quando não mudar nada
      // ═══════════════════════════════════════════════════════════════════════
      const MAX_ITER = 5;

      for (let iter = 0; iter < MAX_ITER; iter++) {
        let mudou = false;

        for (const regra of regras) {
          const source = normCodigo(regra.source_codigo);
          const target = normCodigo(regra.target_codigo);
          const fator  = Number(regra.fator) || 0;
          const aplicar_teto = regra.aplicar_teto_saldo !== false; // default true

          const sourceItem = calcByCodigo[source];
          const targetItem = calcByCodigo[target];

          // Pular sem error
          if (!sourceItem) {
            if (iter === 0) debug.dependencias_puladas.push({ motivo: 'source_nao_encontrado', source, target });
            continue;
          }
          if (!targetItem) {
            if (iter === 0) debug.dependencias_puladas.push({ motivo: 'target_nao_encontrado', source, target });
            continue;
          }
          // override_manual vem do item calculado (já leu do input)
          if (targetItem.override_manual === true) {
            if (iter === 0) debug.dependencias_puladas.push({ motivo: 'override_manual', source, target });
            continue;
          }

          // Quantidades — sem TRUNC2
          const qtd_source_periodo = sourceItem.qtd_periodo_final;
          const periodo_sugerido   = qtd_source_periodo * fator;
          const saldo_antes        = targetItem.qtd_contrato - targetItem.qtd_anterior;

          let qtd_periodo_novo;
          if (aplicar_teto) {
            qtd_periodo_novo = saldo_antes <= 0 ? 0 : Math.min(periodo_sugerido, saldo_antes);
          } else {
            qtd_periodo_novo = periodo_sugerido;
          }

          // Só atualiza se realmente mudou
          if (qtd_periodo_novo !== targetItem.qtd_periodo_final) {
            mudou = true;

            const preco = targetItem.preco_unit_com_bdi;
            const qtd_acumulada_nova = targetItem.qtd_anterior + qtd_periodo_novo;
            const qtd_saldo_novo     = targetItem.qtd_contrato - qtd_acumulada_nova;

            debug.dependencias_aplicadas.push({
              source,
              target,
              fator,
              qtd_source_periodo,
              sugerido:   periodo_sugerido,
              saldo_antes,
              final:      qtd_periodo_novo,
              iteracao:   iter + 1
            });

            // Atualiza in-place — quantidades sem TRUNC2, valores com TRUNC2
            targetItem.qtd_periodo_final = qtd_periodo_novo;
            targetItem.qtd_acumulada     = qtd_acumulada_nova;
            targetItem.qtd_saldo         = qtd_saldo_novo;
            targetItem.vl_periodo        = TRUNC2(qtd_periodo_novo * preco);
            targetItem.vl_acumulado      = TRUNC2(qtd_acumulada_nova * preco);
            targetItem.vl_saldo          = TRUNC2(qtd_saldo_novo * preco);
            // vl_anterior permanece intacto (calculado no passo 1)
          }
        }

        if (!mudou) break;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PASSO 4 — Recalcular totais (após ajustes de dependência)
    // ═══════════════════════════════════════════════════════════════════════════
    let total_anterior  = 0;
    let total_periodo   = 0;
    let total_acumulado = 0;
    let total_saldo     = 0;

    for (const ic of itens_calculados) {
      total_anterior  += ic.vl_anterior;
      total_periodo   += ic.vl_periodo;
      total_acumulado += ic.vl_acumulado;
      total_saldo     += ic.vl_saldo;
    }

    total_anterior  = TRUNC2(total_anterior);
    total_periodo   = TRUNC2(total_periodo);
    total_acumulado = TRUNC2(total_acumulado);
    total_saldo     = TRUNC2(total_saldo);

    const total_contrato = TRUNC2(Number(contratoVersao.total_contrato) || 0);
    const percent_concluida = total_contrato > 0
      ? Math.min(100, TRUNC2((total_acumulado / total_contrato) * 100))
      : 0;

    const bm_calculada = {
      obra_id,
      contrato_versao_id,
      total_contrato,
      total_anterior,
      total_periodo,
      total_acumulado,
      total_saldo,
      percent_concluida
    };

    return {
      ok: true,
      bm_calculada,
      itens_calculados,
      debug
    };

  } catch (error) {
    console.error('[calcBMCompleto]', error?.message);
    return { ok: false, erro: error?.message || 'Erro no cálculo' };
  }
}

/**
 * calcObraProgress: Calcula progresso geral da obra baseado na última BM aprovada
 */
export async function calcObraProgress(params, base44) {
  try {
    const { obra_id } = params;
    if (!obra_id) return { ok: false, erro: 'obra_id obrigatório' };

    const bms = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      status: 'APROVADA'
    }) || [];

    if (bms.length === 0) {
      return { ok: true, percent_concluida: 0, total_acumulado: 0, total_contrato: 0 };
    }

    const ultimaBM = bms[bms.length - 1];

    return {
      ok: true,
      percent_concluida: ultimaBM.percent_concluida || 0,
      total_acumulado:   ultimaBM.total_acumulado || 0,
      total_contrato:    ultimaBM.total_contrato || 0,
      numero_bm:         ultimaBM.numero
    };

  } catch (error) {
    console.error('[calcObraProgress]', error?.message);
    return { ok: false, erro: error?.message };
  }
}