/**
 * getDesviosMedicao: Identifica anomalias e desvios em medições
 * 
 * Detecta:
 * - Atraso físico > threshold
 * - Desvio orçamentário > threshold
 * - Gaps anormais entre BMs
 * - Itens com consumo > orçamento
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, threshold_atraso = 10, threshold_desvio = 5 } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    const alertas = [];

    // Buscar BMs aprovadas
    const bms = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      status: 'APROVADA'
    }) || [];

    if (bms.length === 0) {
      return Response.json({
        success: true,
        obra_id,
        alertas: [],
        total_alertas: 0
      });
    }

    const bmsSorted = bms.sort((a, b) => new Date(a.data_fim) - new Date(b.data_fim));
    const ultimaBM = bmsSorted[bmsSorted.length - 1];

    // Alerta 1: Atraso físico
    const hoje = new Date();
    const dataInicio = new Date(bmsSorted[0].data_inicio);
    const dataFim = new Date(bmsSorted[0].data_fim);
    const diasTotais = Math.max(1, (dataFim - dataInicio) / (1000 * 60 * 60 * 24));
    const diasPassados = Math.max(0, (hoje - dataInicio) / (1000 * 60 * 60 * 24));
    const planejadoHoje = (diasPassados / diasTotais) * 100;
    const atraso = planejadoHoje - (ultimaBM.percent_concluida || 0);

    if (atraso > threshold_atraso) {
      alertas.push({
        tipo: 'ATRASO_FISICO',
        severidade: atraso > 20 ? 'CRITICO' : 'AVISO',
        valor: Math.round(atraso * 100) / 100,
        mensagem: `Obra ${atraso.toFixed(1)}% atrasada (esperado: ${planejadoHoje.toFixed(1)}%, real: ${ultimaBM.percent_concluida?.toFixed(1)}%)`
      });
    }

    // Alerta 2: Desvio orçamentário
    const totalOrcado = ultimaBM.total_contrato || 0;
    const totalAcumulado = ultimaBM.total_acumulado || 0;
    const percentOrcado = (totalAcumulado / totalOrcado) * 100;
    const percentFisico = ultimaBM.percent_concluida || 0;
    const desvioOrcamento = Math.abs(percentOrcado - percentFisico);

    if (desvioOrcamento > threshold_desvio) {
      alertas.push({
        tipo: 'DESVIO_ORCAMENTARIO',
        severidade: desvioOrcamento > 10 ? 'CRITICO' : 'AVISO',
        valor: Math.round(desvioOrcamento * 100) / 100,
        mensagem: percentOrcado > percentFisico 
          ? `Obra com custo acima (${percentOrcado.toFixed(1)}% gasto vs ${percentFisico.toFixed(1)}% executado)`
          : `Obra com margem favorável (${percentOrcado.toFixed(1)}% gasto vs ${percentFisico.toFixed(1)}% executado)`
      });
    }

    // Alerta 3: Gap anormal entre BMs
    for (let i = 1; i < bmsSorted.length; i++) {
      const bmAnterior = bmsSorted[i - 1];
      const bmAtual = bmsSorted[i];
      const gap = (bmAtual.percent_concluida || 0) - (bmAnterior.percent_concluida || 0);
      
      if (gap > 20) {
        alertas.push({
          tipo: 'PROGRESSAO_ANORMAL',
          severidade: 'AVISO',
          valor: Math.round(gap * 100) / 100,
          mensagem: `Salto anormal entre BM #${bmAnterior.numero} e BM #${bmAtual.numero} (+${gap.toFixed(1)}%)`
        });
      }
    }

    // Alerta 4: Itens com consumo > orçamento
    const bmItems = await base44.asServiceRole.entities.BMItem.filter({
      bm_id: ultimaBM.id
    }) || [];

    for (const item of bmItems) {
      if (item.qtd_acumulada > item.qtd_contrato) {
        const excesso = item.qtd_acumulada - item.qtd_contrato;
        alertas.push({
          tipo: 'ITEM_EXCESSO',
          severidade: 'AVISO',
          valor: Math.round(excesso * 1000) / 1000,
          mensagem: `Item ${item.contrato_item_id} consumiu além do orçado (+${excesso.toFixed(2)} unidades)`
        });
      }
    }

    return Response.json({
      success: true,
      obra_id,
      alertas: alertas.sort((a, b) => 
        (b.severidade === 'CRITICO' ? 1 : 0) - (a.severidade === 'CRITICO' ? 1 : 0)
      ),
      total_alertas: alertas.length,
      ultimo_bm_numero: ultimaBM.numero,
      data_ultima_atualizacao: ultimaBM.updated_date
    });

  } catch (error) {
    console.error('[getDesviosMedicao]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao calcular desvios'
    }, { status: 500 });
  }
});