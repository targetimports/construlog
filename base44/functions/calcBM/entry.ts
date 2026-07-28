import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

// TRUNC2: Trunca para 2 casas em direção a zero (sem arredondar)
function TRUNC2(x) {
  const d = new Decimal(x);
  const scaled = d.mul(100);
  const t = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return t.div(100);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const bmId = body?.bm_id;
    const persist = Boolean(body?.persist);
    const overrides = Array.isArray(body?.items_override) ? body.items_override : [];
    if (!bmId) return Response.json({ error: 'bm_id é obrigatório' }, { status: 400 });

    // Carregar BM
    const bmList = await base44.asServiceRole.entities.BM.filter({ id: bmId });
    const bm = bmList?.[0];
    if (!bm) return Response.json({ error: 'BM não encontrado' }, { status: 404 });

    // Bloqueio de persistência para BM aprovada
    if (persist && bm.status === 'APROVADA') {
      return Response.json({ error: 'BM aprovada está bloqueada para edição. Use retificação.' }, { status: 403 });
    }

    // Carregar itens do contrato
    const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id: bm.contrato_versao_id });
    const contratoById = Object.fromEntries(contratoItems.map(ci => [ci.id, ci]));

    // Carregar BMItems existentes
    const bmItems = await base44.asServiceRole.entities.BMItem.filter({ bm_id: bmId });
    const bmItemByContrato = Object.fromEntries(bmItems.map(bmi => [bmi.contrato_item_id, bmi]));

    const overrideMap = Object.fromEntries(overrides.map(o => [o.contrato_item_id, o]));

    // 1) Calcular qtd_anterior a partir de BMs APROVADAS anteriores
    // CRITÉRIO SEGURO: filtra por obra_id + contrato_versao_id + status APROVADA na query
    // filtro em memória redundante garante consistência total (excl. self, obra e versão corretos)
    const prevBMsAll = await base44.asServiceRole.entities.BM.filter({ obra_id: bm.obra_id, contrato_versao_id: bm.contrato_versao_id, status: 'APROVADA' });
    const prevBMs = (prevBMsAll || []).filter(x =>
      x.id !== bmId &&
      x.status === 'APROVADA' &&
      x.obra_id === bm.obra_id &&
      x.contrato_versao_id === bm.contrato_versao_id
    );
    const qtdAnteriorMap = {};
    for (const pbm of prevBMs) {
      const list = await base44.asServiceRole.entities.BMItem.filter({ bm_id: pbm.id });
      for (const it of (list || [])) {
        const cid = it.contrato_item_id;
        const add = new Decimal(it?.qtd_periodo_final || 0);
        qtdAnteriorMap[cid] = (qtdAnteriorMap[cid] || new Decimal(0)).add(add);
      }
    }

    // 2) Preparar mapas auxiliares (por código e por id)
    const contratoByCodigo = Object.fromEntries(contratoItems.map(ci => [ci.item_codigo, ci]));
    const contratoById = Object.fromEntries(contratoItems.map(ci => [ci.id, ci]));

    // 3) Carregar regras de dependência BM_PERIODO
    const regras = await base44.asServiceRole.entities.RegraDependenciaItem.filter({ contrato_versao_id: bm.contrato_versao_id, tipo: 'BM_PERIODO' });
    const regraByTargetCodigo = {};
    for (const r of (regras || [])) {
      regraByTargetCodigo[r.target_codigo] = r; // considerando 1 regra por target
    }

    // 4) Montar dados base por item (primeiro passe)
    const dataById = {};
    for (const contrato of contratoItems) {
      const pu = new Decimal(
        contrato?.preco_unit_com_bdi != null ? contrato.preco_unit_com_bdi : (contrato?.preco_unit != null ? contrato.preco_unit : 0)
      );
      const qtdContrato = new Decimal(contrato?.qtd_contrato || 0);
      const precoTotal = contrato?.preco_total != null ? new Decimal(contrato.preco_total) : qtdContrato.mul(pu);

      const bmi = bmItemByContrato[contrato.id] || {};
      const ov = overrideMap[contrato.id];

      const qtdAnterior = qtdAnteriorMap[contrato.id] || new Decimal(0);
      const qtdPeriodoInput = new Decimal(ov?.qtd_periodo_input != null ? ov.qtd_periodo_input : (bmi?.qtd_periodo_input || 0));
      const overrideManual = Boolean(ov?.override_manual != null ? ov.override_manual : (bmi?.override_manual || false));

      dataById[contrato.id] = {
        contrato,
        codigo: contrato.item_codigo,
        pu,
        qtdContrato,
        precoTotal,
        qtdAnterior,
        qtdPeriodoInput,
        overrideManual,
        qtdPeriodoFinal: qtdPeriodoInput, // será ajustado pelo segundo passe (dependências)
      };
    }

    // 5) Aplicar dependências (segundo passe)
    for (const targetCodigo in regraByTargetCodigo) {
      const regra = regraByTargetCodigo[targetCodigo];
      const targetCi = contratoByCodigo[targetCodigo];
      const sourceCi = contratoByCodigo[regra.source_codigo];
      if (!targetCi) continue; // regra inválida se target não existir
      const targetData = dataById[targetCi.id];
      const sourceData = sourceCi ? dataById[sourceCi.id] : null;

      // Se override_manual=true e a regra permite override, não aplicar automático
      const permiteOverride = regra.permite_override_manual !== false; // default true
      const aplicarAuto = permiteOverride ? !targetData.overrideManual : true;

      if (!aplicarAuto) continue;

      const fator = new Decimal(regra?.fator || 0);
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

    // 6) Consolidar saídas e totais
    let sumContrato = new Decimal(0);
    let sumAnterior = new Decimal(0);
    let sumPeriodo = new Decimal(0);
    let sumAcumulado = new Decimal(0);
    let sumSaldo = new Decimal(0);

    const itemsOut = [];
    const gruposMap = {};

    for (const id in dataById) {
      const d = dataById[id];
      sumContrato = sumContrato.add(d.precoTotal);

      const qtdAcumulada = d.qtdAnterior.add(d.qtdPeriodoFinal);
      const qtdSaldo = d.qtdContrato.sub(qtdAcumulada);

      const vlAnteriorDec = d.qtdAnterior.mul(d.pu);
      const vlPeriodoDec = d.qtdPeriodoFinal.mul(d.pu);
      const vlAcumuladoDec = vlAnteriorDec.add(vlPeriodoDec);
      const vlSaldoDec = d.precoTotal.sub(vlAcumuladoDec);

      const vl_anterior = TRUNC2(vlAnteriorDec).toNumber();
      const vl_periodo = TRUNC2(vlPeriodoDec).toNumber();
      const vl_acumulado = TRUNC2(vlAcumuladoDec).toNumber();
      const vl_saldo = TRUNC2(vlSaldoDec).toNumber();

      sumAnterior = sumAnterior.add(vlAnteriorDec);
      sumPeriodo = sumPeriodo.add(vlPeriodoDec);
      sumAcumulado = sumAcumulado.add(vlAcumuladoDec);
      sumSaldo = sumSaldo.add(vlSaldoDec);

      // Agrupar por prefixo (antes do primeiro ponto). Ex: "2.3" -> grupo "2"
      const codigo = d.codigo || '';
      const grupoKey = String(codigo).includes('.') ? String(codigo).split('.')[0] : String(codigo);
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

      const bmi = bmItemByContrato[id] || {};

      itemsOut.push({
        id: bmi?.id || null,
        bm_id: bmId,
        contrato_item_id: id,
        qtd_periodo_input: d.qtdPeriodoInput.toNumber(),
        override_manual: d.overrideManual,
        qtd_anterior: d.qtdAnterior.toNumber(),
        qtd_periodo_final: d.qtdPeriodoFinal.toNumber(),
        qtd_acumulada: TRUNC2(qtdAcumulada).toNumber(),
        qtd_saldo: TRUNC2(qtdSaldo).toNumber(),
        vl_anterior,
        vl_periodo,
        vl_acumulado,
        vl_saldo,
      });
    }

    const total_contrato = TRUNC2(totalContratoVersao).toNumber();
    const total_anterior = TRUNC2(sumAnterior).toNumber();
    const total_periodo = TRUNC2(sumPeriodo).toNumber();
    const total_acumulado = TRUNC2(sumAcumulado).toNumber();
    const total_saldo = TRUNC2(sumSaldo).toNumber();

    let percent_concluida = new Decimal(0);
    if (totalContratoVersao.gt(0)) {
      percent_concluida = new Decimal(total_acumulado).div(totalContratoVersao).mul(100);
    }
    // clamp 0..100
    if (percent_concluida.lt(0)) percent_concluida = new Decimal(0);
    if (percent_concluida.gt(100)) percent_concluida = new Decimal(100);
    const percent_concluida_trunc = TRUNC2(percent_concluida).toNumber();

    if (persist) {
      // Upsert BMItems
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
            bm_id: it.bm_id,
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

      // Atualização de obra será feita abaixo para unificar (preview e atual)
      if (bm.obra_id) {
        // noop aqui; atualização consolidada após os cálculos
      }
    }

    // Consolidar grupos
    const groupsOut = Object.values(gruposMap)
      .sort((a,b) => String(a.key).localeCompare(String(b.key)))
      .map(g => ({
        grupo: `grupo ${g.key}`,
        vl_anterior: TRUNC2(g.vl_anterior).toNumber(),
        vl_periodo: TRUNC2(g.vl_periodo).toNumber(),
        vl_acumulado: TRUNC2(g.vl_acumulado).toNumber(),
        vl_saldo: TRUNC2(g.vl_saldo).toNumber(),
      }));

    // Atualizar percentuais na Obra (preview = este BM em edição; atual = última BM aprovada)
    let obra_percent_atual = 0;
    if (bm.obra_id) {
      const aprovadas = await base44.asServiceRole.entities.BM.filter({ obra_id: bm.obra_id, contrato_versao_id: bm.contrato_versao_id, status: 'APROVADA' });
      if ((aprovadas || []).length > 0) {
        const ultima = [...aprovadas].sort((a,b) => (b.numero||0) - (a.numero||0))[0];
        let la_acum = new Decimal(ultima?.total_acumulado || 0);
        if (la_acum.eq(0)) {
          const its = await base44.asServiceRole.entities.BMItem.filter({ bm_id: ultima.id });
          la_acum = its.reduce((acc, it) => acc.add(new Decimal(it?.vl_acumulado || 0)), new Decimal(0));
        }
        let pct = new Decimal(0);
        if (totalContratoVersao.gt(0)) pct = la_acum.div(totalContratoVersao).mul(100);
        if (pct.lt(0)) pct = new Decimal(0);
        if (pct.gt(100)) pct = new Decimal(100);
        obra_percent_atual = TRUNC2(pct).toNumber();
      }

      // Atualizar Obra com preview e atual
      await base44.asServiceRole.entities.Obra.update(bm.obra_id, {
        percent_concluida_preview: percent_concluida_trunc,
        percent_concluida_atual: obra_percent_atual,
      });
    }

    return Response.json({
      bm_id: bmId,
      totals: { total_contrato, total_anterior, total_periodo, total_acumulado, total_saldo, percent_concluida: percent_concluida_trunc },
      items: itemsOut,
      groups: groupsOut,
      obra_percent_atual: obra_percent_atual,
      obra_percent_preview: percent_concluida_trunc,
      regras_aplicadas: Object.values(regraByTargetCodigo).map(r => ({ source_codigo: r.source_codigo, target_codigo: r.target_codigo, fator: r.fator }))
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});