/**
 * iaMedicoesAuditOnApprove: Detecta anomalias ao aprovar BM
 * 
 * Uso: chamado antes de aprovar BM
 * Analisa: desvios grandes, saldos suspeitos, descontinuidades, erros óbvios
 * Retorna: alertas com severidade (info, warning, critical)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bm_id } = await req.json();
    if (!bm_id) {
      return Response.json({ error: 'bm_id obrigatório' }, { status: 400 });
    }

    // Buscar BM
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    const alertas = [];

    // Buscar itens da BM
    const itens = await base44.asServiceRole.entities.BMItem.filter({ bm_id }) || [];

    // Buscar BM anterior para comparação
    const bmsAnteriores = await base44.asServiceRole.entities.BM.filter({
      obra_id: bm.obra_id,
      numero: { $lt: bm.numero }
    }) || [];
    const bmAnterior = bmsAnteriores.sort((a, b) => b.numero - a.numero)[0];

    for (const item of itens) {
      // ALERTA 1: Quantidade > saldo
      if (item.qtd_periodo_final > item.qtd_saldo) {
        alertas.push({
          tipo: 'critical',
          item_codigo: item.contrato_item_id,
          titulo: 'Quantidade > Saldo Contrato',
          descricao: `Qtd período ${item.qtd_periodo_final} ultrapassa saldo ${item.qtd_saldo}`,
          valor: item.qtd_periodo_final - item.qtd_saldo
        });
      }

      // ALERTA 2: Desvio grande em relação ao histórico
      if (bmAnterior) {
        const itensAnteriores = await base44.asServiceRole.entities.BMItem.filter({
          bm_id: bmAnterior.id,
          contrato_item_id: item.contrato_item_id
        }) || [];

        if (itensAnteriores.length > 0) {
          const anterior = itensAnteriores[0];
          const qtdAnterior = anterior.qtd_periodo_final || 0;
          const qtdAtual = item.qtd_periodo_final || 0;

          if (qtdAnterior > 0) {
            const variacaoPercent = Math.abs(qtdAtual - qtdAnterior) / qtdAnterior * 100;
            if (variacaoPercent > 150) { // > 150% de mudança
              alertas.push({
                tipo: 'warning',
                item_codigo: item.contrato_item_id,
                titulo: 'Variação Grande na Quantidade',
                descricao: `Mudança de ${qtdAnterior} para ${qtdAtual} (${variacaoPercent.toFixed(1)}%)`,
                valor: variacaoPercent
              });
            }
          }
        }
      }

      // ALERTA 3: Quantity zero em item que sempre teve valor
      if (item.qtd_periodo_final === 0 && item.qtd_anterior > 0) {
        alertas.push({
          tipo: 'info',
          item_codigo: item.contrato_item_id,
          titulo: 'Medição Zerada',
          descricao: `Item que tinha medição anterior agora é zero. Pausado?`,
          valor: item.qtd_anterior
        });
      }
    }

    // ALERTA 4: Saldo total muito baixo
    const saldoTotal = bm.total_saldo || 0;
    const percentualConcluido = bm.percent_concluida || 0;
    if (percentualConcluido > 95 && saldoTotal > 0) {
      alertas.push({
        tipo: 'info',
        titulo: 'Obra Praticamente Concluída',
        descricao: `${percentualConcluido.toFixed(1)}% concluída, saldo ${saldoTotal.toFixed(2)}`,
        valor: saldoTotal
      });
    }

    // ALERTA 5: Chamar IA para análise contextual
    if (alertas.length === 0 || alertas.length > 3) {
      const iaSummary = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é auditor de medições em obra. Analise:
Total período: R$ ${bm.total_periodo}
Total acumulado: R$ ${bm.total_acumulado}
Total contrato: R$ ${bm.total_contrato}
Percentual: ${percentualConcluido}%

Há alguma anomalia grave? Responda em JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            anomalia_detectada: { type: 'boolean' },
            severidade: { type: 'string' },
            descricao: { type: 'string' }
          }
        }
      });

      if (iaSummary.anomalia_detectada) {
        alertas.push({
          tipo: iaSummary.severidade || 'warning',
          titulo: 'Alerta de IA',
          descricao: iaSummary.descricao
        });
      }
    }

    return Response.json({
      success: true,
      bm_id,
      alertas,
      pode_aprovar: alertas.filter(a => a.tipo === 'critical').length === 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[iaMedicoesAuditOnApprove]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao auditar BM'
    }, { status: 500 });
  }
});