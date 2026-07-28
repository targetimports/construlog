/**
 * getAnaliseMedicaoComparativa: Compara orçado vs realizado
 * 
 * Retorna:
 * - Evolução mensalda (orçado vs acumulado)
 * - Comparativo por categoria (se disponível)
 * - Eficiência (realizado / orçado)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, contrato_versao_id } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // Buscar BMs aprovadas
    const bms = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      status: 'APROVADA',
      ...(contrato_versao_id && { contrato_versao_id })
    }) || [];

    if (bms.length === 0) {
      return Response.json({
        success: true,
        obra_id,
        periodos: [],
        resumo: {
          total_orcado: 0,
          total_realizado: 0,
          eficiencia: 0,
          margem: 0
        }
      });
    }

    const bmsSorted = bms.sort((a, b) => new Date(a.data_fim) - new Date(b.data_fim));

    // Agrupar por período (mês)
    const periodos = {};
    let totalOrcado = 0;
    let totalRealizado = 0;

    for (const bm of bmsSorted) {
      const data = new Date(bm.data_fim);
      const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

      if (!periodos[mes]) {
        periodos[mes] = {
          mes,
          orcado: 0,
          realizado: 0,
          acumulado_orcado: 0,
          acumulado_realizado: 0,
          bms: []
        };
      }

      periodos[mes].bms.push(bm.numero);
      periodos[mes].realizado += bm.total_periodo || 0;
      periodos[mes].orcado = bm.total_contrato || 0; // Usa contrato completo
    }

    // Calcular acumulados
    let acumOrcado = 0;
    let acumRealizado = 0;
    const periodosArray = Object.keys(periodos)
      .sort()
      .map(mes => {
        acumOrcado += periodos[mes].orcado;
        acumRealizado += periodos[mes].realizado;
        return {
          ...periodos[mes],
          acumulado_orcado: acumOrcado,
          acumulado_realizado: acumRealizado,
          variacao_percentual: acumOrcado > 0 
            ? Math.round(((acumRealizado - acumOrcado) / acumOrcado) * 10000) / 100
            : 0
        };
      });

    totalOrcado = acumOrcado;
    totalRealizado = acumRealizado;

    // Calcular eficiência
    const eficiencia = totalOrcado > 0 
      ? Math.round((totalRealizado / totalOrcado) * 10000) / 100
      : 0;

    const ultimaBM = bmsSorted[bmsSorted.length - 1];
    const margem = (ultimaBM.total_contrato || 0) - (ultimaBM.total_acumulado || 0);

    return Response.json({
      success: true,
      obra_id,
      periodos: periodosArray,
      resumo: {
        total_orcado: Math.round(totalOrcado * 100) / 100,
        total_realizado: Math.round(totalRealizado * 100) / 100,
        margem: Math.round(margem * 100) / 100,
        eficiencia: eficiencia, // % do orçado já gasto
        saldo_percentual: Math.round((margem / (ultimaBM.total_contrato || 1)) * 10000) / 100,
        total_bms: bmsSorted.length
      }
    });

  } catch (error) {
    console.error('[getAnaliseMedicaoComparativa]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao calcular análise comparativa'
    }, { status: 500 });
  }
});