import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// touch: redeploy 2026-02-26 18:30:00

// Central de Cálculo de Medições (BM)
// Entrada: { bm_id: string, persist?: boolean, items_override?: [{ contrato_item_id, qtd_periodo_input, override_manual? }] }
// Saída: { bm_id, totals, items }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const bmId = body?.bm_id;
    const persist = Boolean(body?.persist);
    const overrides = Array.isArray(body?.items_override) ? body.items_override : [];

    if (!bmId) {
      return Response.json({ error: 'Parâmetro bm_id é obrigatório' }, { status: 400 });
    }

    // Carregar BM
    const bmList = await base44.asServiceRole.entities.BM.filter({ id: bmId });
    const bm = bmList?.[0];
    if (!bm) return Response.json({ error: 'BM não encontrado' }, { status: 404 });

    const contratoVersaoId = bm.contrato_versao_id;
    if (!contratoVersaoId) return Response.json({ error: 'BM sem contrato_versao_id' }, { status: 400 });

    // Carregar Itens do Contrato
    const contratoItems = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id: contratoVersaoId });
    const contratoById = Object.fromEntries(contratoItems.map(ci => [ci.id, ci]));

    // Carregar BMItems existentes
    const bmItems = await base44.asServiceRole.entities.BMItem.filter({ bm_id: bmId });
    const bmItemByContrato = Object.fromEntries(bmItems.map(bmi => [bmi.contrato_item_id, bmi]));

    // Map de overrides
    const overrideMap = Object.fromEntries(overrides.map(o => [o.contrato_item_id, o]));

    // Agregadores de totais
    let totalContrato = 0;
    let totalAnterior = 0;
    let totalPeriodo = 0;
    let totalAcumulado = 0;

    const updatedItems = [];

    for (const contrato of contratoItems) {
      const precoUnit = Number(contrato.preco_unit_com_bdi || 0);
      const qtdContrato = Number(contrato.qtd_contrato || 0);
      const precoTotal = Number(contrato.preco_total || (qtdContrato * precoUnit));

      totalContrato += precoTotal;

      const bmi = bmItemByContrato[contrato.id] || {
        id: null,
        bm_id: bmId,
        contrato_item_id: contrato.id,
        qtd_anterior: 0,
        vl_anterior: 0,
        qtd_periodo_input: 0,
        override_manual: false,
      };

      const ov = overrideMap[contrato.id];
      const qtdPeriodoInput = ov?.qtd_periodo_input != null ? Number(ov.qtd_periodo_input) : Number(bmi.qtd_periodo_input || 0);
      const overrideManual = ov?.override_manual != null ? Boolean(ov.override_manual) : Boolean(bmi.override_manual || false);

      // Regras de cálculo base: para a BASE, qtd_periodo_final = qtd_periodo_input (futuro: dependências/auto-cálculo)
      const qtdAnterior = Number(bmi.qtd_anterior || 0);
      const qtdPeriodoFinal = qtdPeriodoInput; // ponto de extensão
      const qtdAcumulada = qtdAnterior + qtdPeriodoFinal;

      const vlAnterior = Number(bmi.vl_anterior != null ? bmi.vl_anterior : (qtdAnterior * precoUnit));
      const vlPeriodo = Number((qtdPeriodoFinal * precoUnit).toFixed(2));
      const vlAcumulado = Number((vlAnterior + vlPeriodo).toFixed(2));
      const vlSaldo = Number((precoTotal - vlAcumulado).toFixed(2));
      const qtdSaldo = Number((qtdContrato - qtdAcumulada).toFixed(6));

      totalAnterior += vlAnterior;
      totalPeriodo += vlPeriodo;
      totalAcumulado += vlAcumulado;

      updatedItems.push({
        id: bmi.id,
        bm_id: bmId,
        contrato_item_id: contrato.id,
        qtd_periodo_input: qtdPeriodoInput,
        override_manual: overrideManual,
        qtd_anterior: qtdAnterior,
        qtd_periodo_final: qtdPeriodoFinal,
        qtd_acumulada: Number(qtdAcumulada.toFixed(6)),
        qtd_saldo: qtdSaldo,
        vl_anterior: Number(vlAnterior.toFixed(2)),
        vl_periodo: vlPeriodo,
        vl_acumulado: vlAcumulado,
        vl_saldo: vlSaldo,
      });
    }

    const totalSaldo = Number((totalContrato - totalAcumulado).toFixed(2));
    const percent = totalContrato > 0 ? Number(((totalAcumulado / totalContrato) * 100).toFixed(2)) : 0;

    // Persistência opcional
    if (persist) {
      // Atualizar/Upsert BMItems
      for (const it of updatedItems) {
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
          const created = await base44.asServiceRole.entities.BMItem.create({
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
          it.id = created.id;
        }
      }

      // Atualizar BM (totais)
      await base44.asServiceRole.entities.BM.update(bm.id, {
        total_contrato: Number(totalContrato.toFixed(2)),
        total_anterior: Number(totalAnterior.toFixed(2)),
        total_periodo: Number(totalPeriodo.toFixed(2)),
        total_acumulado: Number(totalAcumulado.toFixed(2)),
        total_saldo: totalSaldo,
        percent_concluida: percent,
      });

      // Atualizar percentuais da Obra (preview/atual)
      if (bm.obra_id) {
        await base44.asServiceRole.entities.Obra.update(bm.obra_id, {
          percent_concluida_preview: percent,
        });
      }
    }

    return Response.json({
      bm_id: bmId,
      totals: {
        total_contrato: Number(totalContrato.toFixed(2)),
        total_anterior: Number(totalAnterior.toFixed(2)),
        total_periodo: Number(totalPeriodo.toFixed(2)),
        total_acumulado: Number(totalAcumulado.toFixed(2)),
        total_saldo: totalSaldo,
        percent_concluida: percent,
      },
      items: updatedItems,
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});