/**
 * calcBMv2: Motor central de cálculo de BM
 * 
 * Calcula TODOS os valores por item + dependências:
 * - qtd_anterior (de BMs aprovadas anteriores)
 * - qtd_periodo_final (com regras de dependência e override)
 * - Valores monetários (vl_anterior, vl_periodo, vl_acumulado, vl_saldo)
 * - Totais da BM
 * - % concluída
 * - Atualizar Obra (percent_preview, percent_atual)
 * 
 * REGRAS DE VALIDAÇÃO:
 * - Acumulado NÃO pode ultrapassar Qtd Contrato (saldo negativo bloqueado)
 * - Se qtd_periodo_input + anterior > contrato → recorta ao saldo disponível
 * - Percentual 100% só se TODOS os itens com saldo = 0
 * 
 * Retorna dados SEM persistir (persist=false padrão)
 * Ou persiste se persist=true
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

function TRUNC2(x) {
  if (x === null || x === undefined) return 0;
  const d = new Decimal(x);
  if (d.isZero()) return 0;
  const scaled = d.mul(100);
  const truncated = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return truncated.div(100).toNumber();
}

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
    
    const { bm_id, persist = false, items_override = [] } = payload;
    if (!bm_id) {
      return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });
    }

    // Buscar BM
    const bms = await base44.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) {
      return Response.json({ error: 'BM não encontrada' }, { status: 404 });
    }

    // Se BM APROVADA e persist=true, bloquear
    if (persist && bm.status === 'APROVADA') {
      return Response.json({ 
        error: 'BM aprovada está bloqueada. Use retificação.' 
      }, { status: 403 });
    }

    // Buscar contrato versão
    const versoes = await base44.entities.ContratoVersao.filter({ 
      id: bm.contrato_versao_id 
    }) || [];
    const versao = versoes[0];
    if (!versao) {
      return Response.json({ error: 'ContratoVersao não encontrada' }, { status: 404 });
    }

    // Buscar itens do contrato
    const contratoItems = await base44.entities.ContratoItem.filter({ 
      contrato_versao_id: bm.contrato_versao_id 
    }) || [];

    console.log(`[calcBMv2] bm_id=${bm_id} obra_id=${bm.obra_id} contrato_versao_id=${bm.contrato_versao_id} contrato_itens_count=${contratoItems.length}`);

    if (contratoItems.length === 0) {
      return Response.json({
        bm_id,
        status: bm.status,
        persisted: false,
        items: [],
        groups: [],
        totals: { total_contrato: 0, total_anterior: 0, total_periodo: 0, total_acumulado: 0, total_saldo: 0, percent_concluida: 0 },
        validation_errors: [],
        diagnostico: {
          bm_id,
          obra_id: bm.obra_id,
          contrato_versao_id: bm.contrato_versao_id,
          contrato_itens_count: 0,
          bm_items_count: 0,
          aviso: `Nenhum ContratoItem encontrado para contrato_versao_id=${bm.contrato_versao_id}. Cadastre itens no contrato antes de medir.`
        }
      });
    }

    const contratoById = Object.fromEntries(contratoItems.map(ci => [ci.id, ci]));
    const contratoByCodigoMap = Object.fromEntries(contratoItems.map(ci => [ci.item_codigo, ci]));

    // Buscar BMItems existentes
    const bmItems = await base44.entities.BMItem.filter({ bm_id }) || [];
    const bmItemByContratoId = Object.fromEntries(bmItems.map(bmi => [bmi.contrato_item_id, bmi]));
    console.log(`[calcBMv2] bm_items_count=${bmItems.length}`);

    // Mapa de overrides
    const overrideMap = Object.fromEntries(items_override.map(o => [o.contrato_item_id, o]));

    // 1) Calcular qtd_anterior para cada item (de BMs APROVADAS anteriores)
    const prevBMs = await base44.entities.BM.filter({ 
      obra_id: bm.obra_id,
      contrato_versao_id: bm.contrato_versao_id,
      status: 'APROVADA'
    }) || [];
    
    const prevBMsOrdenadas = (prevBMs || []).filter(x =>
      x.id !== bm_id &&
      x.status === 'APROVADA' &&
      x.obra_id === bm.obra_id &&
      x.contrato_versao_id === bm.contrato_versao_id
    );
    
    const qtdAnteriorMap = {};
    for (const pbm of prevBMsOrdenadas) {
      const prevItems = await base44.entities.BMItem.filter({ bm_id: pbm.id }) || [];
      for (const it of prevItems) {
        const cid = it.contrato_item_id;
        const add = new Decimal(it.qtd_periodo_final || 0);
        qtdAnteriorMap[cid] = (qtdAnteriorMap[cid] || new Decimal(0)).add(add);
      }
    }

    // 2) Buscar regras BM_PERIODO
    const regras = await base44.entities.RegraDependenciaItem.filter({ 
      contrato_versao_id: bm.contrato_versao_id,
      tipo: 'BM_PERIODO'
    }) || [];
    const regraByTargetCodigo = {};
    for (const r of regras) {
      regraByTargetCodigo[r.target_codigo] = r;
    }

    // 3) Preparar dados base por item (primeiro passe)
    const dataById = {};
    for (const ci of contratoItems) {
      const pu = new Decimal(ci.preco_unit_com_bdi || ci.preco_unit || 0);
      const qtdContrato = new Decimal(ci.qtd_contrato || 0);
      const precoTotal = ci.preco_total ? new Decimal(ci.preco_total) : qtdContrato.mul(pu);

      const bmi = bmItemByContratoId[ci.id] || {};
      const ov = overrideMap[ci.id];

      const qtdAnterior = qtdAnteriorMap[ci.id] || new Decimal(0);
      const qtdPeriodoInput = new Decimal(
        ov?.qtd_periodo_input != null ? ov.qtd_periodo_input : (bmi.qtd_periodo_input || 0)
      );
      const overrideManual = Boolean(
        ov?.override_manual != null ? ov.override_manual : (bmi.override_manual || false)
      );

      dataById[ci.id] = {
        contrato: ci,
        codigo: ci.item_codigo,
        pu,
        qtdContrato,
        precoTotal,
        qtdAnterior,
        qtdPeriodoInput,
        overrideManual,
        qtdPeriodoFinal: qtdPeriodoInput, // será ajustado nos passos seguintes
      };
    }

    // 4) Aplicar dependências (segundo passe)
    for (const targetCodigo in regraByTargetCodigo) {
      const regra = regraByTargetCodigo[targetCodigo];
      const targetCi = contratoByCodigoMap[targetCodigo];
      const sourceCi = contratoByCodigoMap[regra.source_codigo];

      if (!targetCi) continue;

      const targetData = dataById[targetCi.id];
      const sourceData = sourceCi ? dataById[sourceCi.id] : null;

      const permiteOverride = regra.permite_override_manual !== false;
      const aplicarAuto = permiteOverride ? !targetData.overrideManual : true;

      if (!aplicarAuto) continue;

      const fator = new Decimal(regra.fator || 0);
      const periodoSugerido = sourceData ? sourceData.qtdPeriodoFinal.mul(fator) : new Decimal(0);

      let teto = periodoSugerido;
      if (regra.aplicar_teto_saldo !== false) {
        const saldoTargetAntes = targetData.qtdContrato.sub(targetData.qtdAnterior);
        if (saldoTargetAntes.lt(0)) {
          teto = new Decimal(0);
        } else {
          teto = Decimal.min(periodoSugerido, saldoTargetAntes);
        }
      }

      targetData.qtdPeriodoFinal = teto;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4.5) REGRA CRÍTICA: Limitar qtd_periodo_final ao saldo disponível
    //      Acumulado NÃO pode ultrapassar Qtd Contrato
    //      Aplica para TODOS os itens (com e sem regra de dependência)
    // ═══════════════════════════════════════════════════════════════════
    const validationErrors = [];

    for (const id in dataById) {
      const d = dataById[id];
      const saldoDisponivel = d.qtdContrato.sub(d.qtdAnterior);

      // Se saldo disponível <= 0, forçar período = 0
      if (saldoDisponivel.lte(0)) {
        if (d.qtdPeriodoFinal.gt(0)) {
          validationErrors.push({
            contrato_item_id: id,
            item_codigo: d.codigo,
            tipo: 'SALDO_ESGOTADO',
            mensagem: `Item ${d.codigo}: Saldo esgotado. Qtd contrato=${d.qtdContrato.toNumber()}, Anterior=${d.qtdAnterior.toNumber()}. Período zerado.`,
            qtd_original: d.qtdPeriodoInput.toNumber(),
            qtd_corrigida: 0
          });
          d.qtdPeriodoFinal = new Decimal(0);
        }
        continue;
      }

      // Se qtd_periodo_final > saldo disponível, recortar
      if (d.qtdPeriodoFinal.gt(saldoDisponivel)) {
        validationErrors.push({
          contrato_item_id: id,
          item_codigo: d.codigo,
          tipo: 'EXCEDE_CONTRATO',
          mensagem: `Item ${d.codigo}: Qtd medida (${d.qtdPeriodoFinal.toNumber()}) excede saldo disponível (${saldoDisponivel.toNumber()}). Recortada para ${saldoDisponivel.toNumber()}.`,
          qtd_original: d.qtdPeriodoInput.toNumber(),
          qtd_corrigida: saldoDisponivel.toNumber()
        });
        d.qtdPeriodoFinal = saldoDisponivel;
      }

      // Segurança: não permitir período negativo
      if (d.qtdPeriodoFinal.lt(0)) {
        d.qtdPeriodoFinal = new Decimal(0);
      }
    }

    // 5) Consolidar saídas
    let sumContrato = new Decimal(0);
    let sumAnterior = new Decimal(0);
    let sumPeriodo = new Decimal(0);
    let sumAcumulado = new Decimal(0);
    let sumSaldo = new Decimal(0);

    const itemsOut = [];
    const gruposMap = {};
    let todosItensZerados = true; // Flag para validação de 100%

    for (const id in dataById) {
      const d = dataById[id];
      sumContrato = sumContrato.add(d.precoTotal);

      const qtdAcumulada = d.qtdAnterior.add(d.qtdPeriodoFinal);
      const qtdSaldo = d.qtdContrato.sub(qtdAcumulada);

      const vlAnteriorDec = d.qtdAnterior.mul(d.pu);
      const vlPeriodoDec = d.qtdPeriodoFinal.mul(d.pu);
      const vlAcumuladoDec = vlAnteriorDec.add(vlPeriodoDec);
      const vlSaldoDec = d.precoTotal.sub(vlAcumuladoDec);

      const vl_anterior = TRUNC2(vlAnteriorDec.toNumber());
      const vl_periodo = TRUNC2(vlPeriodoDec.toNumber());
      const vl_acumulado = TRUNC2(vlAcumuladoDec.toNumber());
      const vl_saldo = TRUNC2(vlSaldoDec.toNumber());

      // Verificar se algum item tem saldo != 0 (para validação de 100%)
      if (!qtdSaldo.isZero() || !vlSaldoDec.isZero()) {
        todosItensZerados = false;
      }

      sumAnterior = sumAnterior.add(vlAnteriorDec);
      sumPeriodo = sumPeriodo.add(vlPeriodoDec);
      sumAcumulado = sumAcumulado.add(vlAcumuladoDec);
      sumSaldo = sumSaldo.add(vlSaldoDec);

      // Agrupar por prefixo (grupo)
      const grupoKey = String(d.codigo).includes('.') 
        ? String(d.codigo).split('.')[0] 
        : String(d.codigo);
      
      if (!gruposMap[grupoKey]) {
        gruposMap[grupoKey] = {
          key: grupoKey,
          vl_anterior: new Decimal(0),
          vl_periodo: new Decimal(0),
          vl_acumulado: new Decimal(0),
          vl_saldo: new Decimal(0),
        };
      }
      gruposMap[grupoKey].vl_anterior = gruposMap[grupoKey].vl_anterior.add(vlAnteriorDec);
      gruposMap[grupoKey].vl_periodo = gruposMap[grupoKey].vl_periodo.add(vlPeriodoDec);
      gruposMap[grupoKey].vl_acumulado = gruposMap[grupoKey].vl_acumulado.add(vlAcumuladoDec);
      gruposMap[grupoKey].vl_saldo = gruposMap[grupoKey].vl_saldo.add(vlSaldoDec);

      const bmi = bmItemByContratoId[id] || {};

      itemsOut.push({
        id: bmi.id || null,
        bm_id,
        contrato_item_id: id,
        item_codigo: d.codigo,
        item_label: d.contrato.item_label || d.contrato.descricao,
        descricao: d.contrato.descricao,
        unidade: d.contrato.unidade,
        preco_unit_com_bdi: d.pu.toNumber(),
        preco_total: d.precoTotal.toNumber(),
        _has_dependency: !!regraByTargetCodigo[d.codigo],
        qtd_contrato: d.qtdContrato.toNumber(),
        qtd_periodo_input: d.qtdPeriodoInput.toNumber(),
        override_manual: d.overrideManual,
        qtd_anterior: d.qtdAnterior.toNumber(),
        qtd_periodo_final: d.qtdPeriodoFinal.toNumber(),
        qtd_acumulada: TRUNC2(qtdAcumulada.toNumber()),
        qtd_saldo: TRUNC2(qtdSaldo.toNumber()),
        vl_anterior,
        vl_periodo,
        vl_acumulado,
        vl_saldo,
        // Flag para UI: item foi recortado pelo motor?
        _recortado: d.qtdPeriodoFinal.lt(d.qtdPeriodoInput),
      });
    }

    const total_contrato = TRUNC2(sumContrato.toNumber());
    const total_anterior = TRUNC2(sumAnterior.toNumber());
    const total_periodo = TRUNC2(sumPeriodo.toNumber());
    const total_acumulado = TRUNC2(sumAcumulado.toNumber());
    const total_saldo = TRUNC2(sumSaldo.toNumber());

    // ═══════════════════════════════════════════════════════════════════
    // PERCENTUAL: só permite 100% se TODOS os itens com saldo zerado
    // ═══════════════════════════════════════════════════════════════════
    let percent_concluida = new Decimal(0);
    if (sumContrato.gt(0)) {
      percent_concluida = new Decimal(total_acumulado).div(sumContrato).mul(100);
    }
    if (percent_concluida.lt(0)) percent_concluida = new Decimal(0);
    
    // Regra: 100% somente se TODOS os itens têm saldo zerado
    if (percent_concluida.gte(100)) {
      if (todosItensZerados) {
        percent_concluida = new Decimal(100);
      } else {
        // Existem itens com saldo, limitar a 99.99%
        percent_concluida = new Decimal(99.99);
      }
    }
    const percent_concluida_trunc = TRUNC2(percent_concluida.toNumber());

    // 6) Se persist=true, salvar
    let obra_percent_atual = 0;
    if (persist) {
      // Bloquear persistência se há erros de validação (saldo negativo)
      const errosCriticos = validationErrors.filter(e => e.tipo === 'SALDO_ESGOTADO' || e.tipo === 'EXCEDE_CONTRATO');
      if (errosCriticos.length > 0) {
        console.warn(`[calcBMv2] ${errosCriticos.length} itens recortados ao salvar. Valores corrigidos automaticamente.`);
      }

      for (const it of itemsOut) {
        if (it.id) {
          await base44.asServiceRole.entities.BMItem.update(it.id, {
            qtd_periodo_input: it.qtd_periodo_input,
            override_manual: it.override_manual,
            qtd_anterior: it.qtd_anterior,
            qtd_periodo_final: it.qtd_periodo_final,
            qtd_acumulada: it.qtd_acumulada,
            qtd_saldo: it.qtd_saldo,
            vl_anterior: it.vl_anterior,
            vl_periodo: it.vl_periodo,
            vl_acumulado: it.vl_acumulado,
            vl_saldo: it.vl_saldo,
          });
        } else {
          await base44.asServiceRole.entities.BMItem.create({
            bm_id,
            contrato_item_id: it.contrato_item_id,
            qtd_periodo_input: it.qtd_periodo_input,
            override_manual: it.override_manual,
            qtd_anterior: it.qtd_anterior,
            qtd_periodo_final: it.qtd_periodo_final,
            qtd_acumulada: it.qtd_acumulada,
            qtd_saldo: it.qtd_saldo,
            vl_anterior: it.vl_anterior,
            vl_periodo: it.vl_periodo,
            vl_acumulado: it.vl_acumulado,
            vl_saldo: it.vl_saldo,
          });
        }
      }

      // Atualizar BM
      await base44.asServiceRole.entities.BM.update(bm.id, {
        total_contrato,
        total_anterior,
        total_periodo,
        total_acumulado,
        total_saldo,
        percent_concluida: percent_concluida_trunc,
      });

      // Atualizar Obra
      if (bm.obra_id) {
        const ultimaBMAprovada = (prevBMsOrdenadas || []).sort((a,b) => (b.numero||0) - (a.numero||0))[0];
        if (ultimaBMAprovada) {
          const ultimaItems = await base44.entities.BMItem.filter({ bm_id: ultimaBMAprovada.id }) || [];
          const somaAcum = ultimaItems.reduce((acc, it) => acc + (it.vl_acumulado || 0), 0);
          let pct = new Decimal(0);
          if (sumContrato.gt(0)) {
            pct = new Decimal(somaAcum).div(sumContrato).mul(100);
          }
          if (pct.lt(0)) pct = new Decimal(0);
          if (pct.gt(100)) pct = new Decimal(100);
          obra_percent_atual = TRUNC2(pct.toNumber());
        }

        await base44.asServiceRole.entities.Obra.update(bm.obra_id, {
          percent_concluida_preview: percent_concluida_trunc,
          percent_concluida_atual: obra_percent_atual,
        });
      }
    }

    // 7) Retornar resultado
    const groupsOut = Object.values(gruposMap)
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
      .map(g => ({
        grupo: `grupo ${g.key}`,
        vl_anterior: TRUNC2(g.vl_anterior.toNumber()),
        vl_periodo: TRUNC2(g.vl_periodo.toNumber()),
        vl_acumulado: TRUNC2(g.vl_acumulado.toNumber()),
        vl_saldo: TRUNC2(g.vl_saldo.toNumber()),
      }));

    return Response.json({
      bm_id,
      status: bm.status,
      persisted: persist,
      validation_errors: validationErrors,
      diagnostico: {
        bm_id,
        obra_id: bm.obra_id,
        contrato_versao_id: bm.contrato_versao_id,
        contrato_itens_count: contratoItems.length,
        bm_items_count: bmItems.length,
      },
      totals: {
        total_contrato,
        total_anterior,
        total_periodo,
        total_acumulado,
        total_saldo,
        percent_concluida: percent_concluida_trunc,
      },
      items: itemsOut,
      groups: groupsOut,
      obra_percent_atual: persist ? (obra_percent_atual || 0) : undefined,
      obra_percent_preview: percent_concluida_trunc,
    });

  } catch (error) {
    console.error('[calcBMv2]', error?.message);
    return Response.json({ error: error?.message || 'Erro ao calcular BM' }, { status: 500 });
  }
});