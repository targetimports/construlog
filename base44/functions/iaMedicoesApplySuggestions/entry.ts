/**
 * iaMedicoesApplySuggestions: Aplica/rejeita sugestões IA na BM
 * 
 * Uso: usuário clica "Aplicar" ou "Rejeitar" na UI de sugestões
 * Atualiza BMItem + registra auditoria
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { bm_id, sugestoes_aplicadas, acao } = await req.json();
    if (!bm_id || !sugestoes_aplicadas || !['apply', 'reject'].includes(acao)) {
      return Response.json({ 
        error: 'bm_id, sugestoes_aplicadas (array) e acao (apply|reject) obrigatórios' 
      }, { status: 400 });
    }

    // Buscar BM
    const bms = await base44.asServiceRole.entities.BM.filter({ id: bm_id }) || [];
    const bm = bms[0];
    if (!bm) return Response.json({ error: 'BM não encontrada' }, { status: 404 });

    const atualizacoes = [];

    if (acao === 'apply') {
      // Aplicar sugestões
      for (const sugestao of sugestoes_aplicadas) {
        const items = await base44.asServiceRole.entities.BMItem.filter({
          bm_id,
          contrato_item_id: sugestao.contrato_item_id
        }) || [];

        if (items.length > 0) {
          const item = items[0];
          
          // Atualizar com quantidade sugerida
          await base44.asServiceRole.entities.BMItem.update(item.id, {
            qtd_periodo_input: sugestao.quantidade_sugerida,
            override_manual: false // IA preencheu
          });

          // Registrar auditoria
          await base44.asServiceRole.entities.AuditLog.create({
            obra_id: bm.obra_id,
            entidade: 'BMItem',
            entidade_id: item.id,
            acao: 'update',
            usuario_id: user.email,
            observacao: `Sugestão IA aplicada: ${item.qtd_periodo_input} → ${sugestao.quantidade_sugerida} (confiança ${sugestao.confianca}%)`,
            dados_antes: { qtd_periodo_input: item.qtd_periodo_input },
            dados_depois: { qtd_periodo_input: sugestao.quantidade_sugerida }
          });

          atualizacoes.push({
            item_id: item.id,
            contrato_item_id: sugestao.contrato_item_id,
            valor_anterior: item.qtd_periodo_input,
            valor_novo: sugestao.quantidade_sugerida,
            status: 'aplicada'
          });
        }
      }
    } else {
      // Rejeitar sugestões (apenas registra, sem alterar dados)
      for (const sugestao of sugestoes_aplicadas) {
        const items = await base44.asServiceRole.entities.BMItem.filter({
          bm_id,
          contrato_item_id: sugestao.contrato_item_id
        }) || [];

        if (items.length > 0) {
          const item = items[0];
          await base44.asServiceRole.entities.AuditLog.create({
            obra_id: bm.obra_id,
            entidade: 'BMItem',
            entidade_id: item.id,
            acao: 'update',
            usuario_id: user.email,
            observacao: `Sugestão IA rejeitada: ${item.qtd_periodo_input} mantido (rejeitou ${sugestao.quantidade_sugerida})`,
            dados_depois: { sugestao_rejeitada: sugestao.quantidade_sugerida }
          });

          atualizacoes.push({
            item_id: item.id,
            contrato_item_id: sugestao.contrato_item_id,
            valor_mantido: item.qtd_periodo_input,
            status: 'rejeitada'
          });
        }
      }
    }

    return Response.json({
      success: true,
      bm_id,
      acao,
      atualizacoes: atualizacoes.length,
      detalhes: atualizacoes
    });

  } catch (error) {
    console.error('[iaMedicoesApplySuggestions]', error?.message);
    return Response.json({
      error: error?.message || 'Erro ao aplicar sugestões'
    }, { status: 500 });
  }
});