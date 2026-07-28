/**
 * getCurvaSMedicao: Calcula Curva S (progresso acumulado vs planejado)
 * 
 * Retorna:
 * - Série temporal de BMs aprovadas
 * - % acumulado vs data_fim planejada
 * - Desvio físico
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

    // Buscar todas as BMs aprovadas
    const bms = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      status: 'APROVADA',
      ...(contrato_versao_id && { contrato_versao_id })
    }) || [];

    // Ordenar por data_fim
    const bmsSorted = bms.sort((a, b) => 
      new Date(a.data_fim) - new Date(b.data_fim)
    );

    // Calcular série temporal
    const curvaData = [];
    let acumulado = 0;
    let acumuladoValor = 0;

    for (const bm of bmsSorted) {
      acumulado = bm.percent_concluida || 0;
      acumuladoValor = bm.total_acumulado || 0;

      curvaData.push({
        data: bm.data_fim,
        numero_bm: bm.numero,
        percentual_acumulado: acumulado,
        valor_acumulado: acumuladoValor,
        total_contrato: bm.total_contrato
      });
    }

    // Calcular planejado (linear se não houver cronograma)
    const hoje = new Date();
    const dataPrimeira = bmsSorted[0]?.data_inicio ? new Date(bmsSorted[0].data_inicio) : hoje;
    const dataUltima = bmsSorted[0]?.data_fim ? new Date(bmsSorted[0].data_fim) : new Date(hoje.setMonth(hoje.getMonth() + 3));
    const diasTotais = Math.max(1, (dataUltima - dataPrimeira) / (1000 * 60 * 60 * 24));
    const diasPassados = Math.max(0, (hoje - dataPrimeira) / (1000 * 60 * 60 * 24));
    const planejadoHoje = Math.min(100, (diasPassados / diasTotais) * 100);

    // Calcular desvio
    const ultimaBM = bmsSorted[bmsSorted.length - 1];
    const percentualReal = ultimaBM?.percent_concluida || 0;
    const desvioFisico = percentualReal - planejadoHoje;

    return Response.json({
      success: true,
      obra_id,
      total_bms_aprovadas: bmsSorted.length,
      curva_data: curvaData,
      planejado_hoje: Math.round(planejadoHoje * 100) / 100,
      percentual_real: Math.round(percentualReal * 100) / 100,
      desvio_fisico: Math.round(desvioFisico * 100) / 100,
      status_desvio: desvioFisico > 5 ? 'ADIANTADO' : desvioFisico < -5 ? 'ATRASADO' : 'NO_PRAZO',
      data_primeira_bm: dataPrimeira.toISOString().split('T')[0],
      data_ultima_bm: dataUltima.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('[getCurvaSMedicao]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao calcular Curva S'
    }, { status: 500 });
  }
});