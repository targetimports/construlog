/**
 * iaMedicoesExtract: Analisa histórico de BMs, sugere quantidades por padrão IA
 * 
 * Uso: ao abrir BMDetalhes em RASCUNHO, busca BMs anteriores + padrões
 * Retorna: lista de sugestões com confiança por item
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bm_id, contrato_versao_id } = await req.json();
    if (!bm_id || !contrato_versao_id) {
      return Response.json({ error: 'bm_id e contrato_versao_id obrigatórios' }, { status: 400 });
    }

    // Buscar BM atual
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    // Buscar histórico de BMs anteriores (mesma obra, mesma ou versão anterior)
    const historicoRaw = await base44.asServiceRole.entities.BM.filter({
      obra_id: bm.obra_id,
      status: 'APROVADA' // Apenas aprovadas para padrão estável
    }) || [];

    const historico = historicoRaw
      .filter(b => b.numero < bm.numero) // Antes da atual
      .sort((a, b) => b.numero - a.numero) // Mais recente primeiro
      .slice(0, 6); // Últimas 6 BMs

    if (historico.length === 0) {
      return Response.json({
        success: true,
        sugestoes: [],
        confianca_geral: 0,
        motivo: 'Sem histórico para análise'
      });
    }

    // Buscar itens da BM atual
    const itensAtuais = await base44.asServiceRole.entities.BMItem.filter({
      bm_id
    }) || [];

    // Para cada item, calcular média + desvio + tendência
    const sugestoes = [];

    for (const itemAtual of itensAtuais) {
      // Buscar mesmos itens no histórico
      const itemsHistorico = [];
      for (const bmHistorica of historico) {
        const items = await base44.asServiceRole.entities.BMItem.filter({
          bm_id: bmHistorica.id,
          contrato_item_id: itemAtual.contrato_item_id
        }) || [];
        if (items.length > 0) itemsHistorico.push(items[0]);
      }

      if (itemsHistorico.length < 2) continue; // Precisa de pelo menos 2 pontos

      // Calcular média, desvio padrão, tendência
      const quantidades = itemsHistorico.map(i => i.qtd_periodo_final || 0);
      const media = new Decimal(quantidades.reduce((a, b) => a + b, 0)).div(quantidades.length);
      
      const variancia = new Decimal(
        quantidades.reduce((sum, q) => {
          const diff = new Decimal(q).minus(media);
          return sum.add(diff.pow(2));
        }, new Decimal(0))
      ).div(quantidades.length);
      const desvio = variancia.sqrt();

      // Tendência (últimas 3 vs primeiras 3)
      const recent = quantidades.slice(0, 3);
      const older = quantidades.slice(-3);
      const mediaRecente = new Decimal(recent.reduce((a, b) => a + b, 0)).div(recent.length);
      const mediaAntiga = new Decimal(older.reduce((a, b) => a + b, 0)).div(older.length);
      const tendencia = mediaRecente.div(mediaAntiga).minus(1).mul(100).toNumber(); // % mudança

      // Usar LLM para análise contextual
      const analiseIA = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é analista de engenharia de obra. 
Histórico de medições para item "${itemAtual.contrato_item_id}":
Quantidades últimas 6 medições: ${quantidades.join(', ')}
Média: ${media.toNumber().toFixed(2)}
Desvio padrão: ${desvio.toNumber().toFixed(2)}
Tendência últimas medições: ${tendencia > 0 ? '+' : ''}${tendencia.toFixed(1)}%

Sugira a próxima quantidade com confiança (0-100). Resposta JSON.`,
        response_json_schema: {
          type: 'object',
          properties: {
            quantidade_sugerida: { type: 'number' },
            confianca: { type: 'number' },
            motivo: { type: 'string' }
          }
        }
      });

      sugestoes.push({
        contrato_item_id: itemAtual.contrato_item_id,
        quantidade_atual: itemAtual.qtd_periodo_input || 0,
        quantidade_sugerida: analiseIA.quantidade_sugerida,
        media_historica: media.toNumber(),
        desvio: desvio.toNumber(),
        tendencia_percent: tendencia,
        confianca: analiseIA.confianca,
        motivo: analiseIA.motivo,
        pontos_historicos: quantidades.length
      });
    }

    // Confiança geral = média das confiançasindividuais
    const confiancaGeral = sugestoes.length > 0 
      ? sugestoes.reduce((sum, s) => sum + s.confianca, 0) / sugestoes.length
      : 0;

    return Response.json({
      success: true,
      bm_id,
      sugestoes,
      confianca_geral: Math.round(confiancaGeral),
      pontos_analisados: historicoRaw.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[iaMedicoesExtract]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao extrair sugestões IA'
    }, { status: 500 });
  }
});