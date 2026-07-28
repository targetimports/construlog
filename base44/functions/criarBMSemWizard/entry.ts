/**
 * criarBMSemWizard: Cria BM + BMItems (sem wizard)
 * 
 * Botão "Nova Medição" → chama esta função
 * - Cria BM RASCUNHO
 * - Cria BMItem para cada ContratoItem da versão vigente
 * - Retorna bm_id para abrir tela de edição
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    // Aceitar obra_id ou obraId (camelCase/snake_case)
    const obra_id = payload.obra_id || payload.obraId;
    console.log('[criarBMSemWizard] payload recebido:', JSON.stringify(payload));
    console.log('[criarBMSemWizard] obra_id resolvido:', obra_id);

    if (!obra_id) {
      return Response.json({ ok: false, error: 'obra_id obrigatório' }, { status: 400 });
    }

    // Buscar obra
    const obras = await base44.entities.Obra.filter({ id: obra_id }) || [];
    const obra = obras[0];
    console.log('[criarBMSemWizard] obra encontrada:', obra ? `${obra.id} / ${obra.nome}` : 'NÃO ENCONTRADA');
    if (!obra) {
      return Response.json({ ok: false, error: 'Obra não encontrada' }, { status: 404 });
    }

    // Buscar ContratoVersao ATIVA — tentar também sem filtro de status se não achar
    let versoes = await base44.entities.ContratoVersao.filter({ obra_id, status: 'ATIVA' }) || [];
    console.log('[criarBMSemWizard] versões ATIVA encontradas:', versoes.length);

    if (versoes.length === 0) {
      // Fallback: qualquer versão da obra
      versoes = await base44.entities.ContratoVersao.filter({ obra_id }) || [];
      console.log('[criarBMSemWizard] versões (qualquer status):', versoes.length, versoes.map(v => `${v.id}/${v.status}`));
    }

    // Se ainda não há versão, criar uma versão mínima automaticamente
    let versaoAtiva;
    if (versoes.length === 0) {
      console.log('[criarBMSemWizard] Criando ContratoVersao mínima automaticamente...');
      versaoAtiva = await base44.entities.ContratoVersao.create({
        obra_id,
        numero_versao: 1,
        status: 'ATIVA',
        total_contrato: obra.total_final_orcamento || obra.total_orcamento || 0
      });
      console.log('[criarBMSemWizard] ContratoVersao criada:', versaoAtiva.id);
    } else {
      versaoAtiva = versoes[0];
    }

    // ══════════════════════════════════════════════════════════════
    // BLOQUEIO ESTRUTURAL: ContratoVersao DEVE ter ContratoItem
    // ══════════════════════════════════════════════════════════════
    const contratoItemsCheck = await base44.entities.ContratoItem.filter({ contrato_versao_id: versaoAtiva.id }) || [];
    console.log('[criarBMSemWizard] GUARD: contrato_versao_id=' + versaoAtiva.id + ' contratoItems=' + contratoItemsCheck.length);

    if (contratoItemsCheck.length === 0) {
      return Response.json({
        ok: false,
        code: 'CONTRATO_SEM_ITENS',
        error: 'Esta versão de contrato não possui itens. Cadastre os itens antes de criar uma medição.',
        contrato_versao_id: versaoAtiva.id,
        obra_id
      }, { status: 400 });
    }

    // Contar BMs existentes para número sequencial
    const bmsExistentes = await base44.entities.BM.filter({ obra_id }) || [];
    const numero = (bmsExistentes.length || 0) + 1;
    console.log('[criarBMSemWizard] BMs existentes:', bmsExistentes.length, '→ novo numero:', numero);

    // Criar BM RASCUNHO
    const bmPayload = {
      obra_id,
      contrato_versao_id: versaoAtiva.id,
      numero,
      data_inicio: new Date().toISOString().split('T')[0],
      status: 'RASCUNHO',
      total_contrato: versaoAtiva.total_contrato || 0,
      total_anterior: 0,
      total_periodo: 0,
      total_acumulado: 0,
      total_saldo: versaoAtiva.total_contrato || 0,
      percent_concluida: 0
    };
    console.log('[criarBMSemWizard] criando BM:', JSON.stringify(bmPayload));
    const bm = await base44.entities.BM.create(bmPayload);
    console.log('[criarBMSemWizard] BM criada:', JSON.stringify({ id: bm.id, obra_id: bm.obra_id, status: bm.status, numero: bm.numero }));

    // Buscar e criar BMItems
    const contratoItems = await base44.entities.ContratoItem.filter({ contrato_versao_id: versaoAtiva.id }) || [];
    console.log('[criarBMSemWizard] contratoItems encontrados:', contratoItems.length);

    let itensCount = 0;
    for (const ci of contratoItems) {
      try {
        await base44.entities.BMItem.create({
          bm_id: bm.id,
          contrato_item_id: ci.id,
          qtd_periodo_input: 0,
          override_manual: false,
          qtd_anterior: 0,
          qtd_periodo_final: 0,
          qtd_acumulada: 0,
          qtd_saldo: ci.qtd_contrato || 0,
          vl_anterior: 0,
          vl_periodo: 0,
          vl_acumulado: 0,
          vl_saldo: ci.preco_total || 0
        });
        itensCount++;
      } catch (e) {
        console.warn('[criarBMSemWizard] Erro ao criar BMItem:', ci.id, e.message);
      }
    }

    // ── BM_AUDIT ──
    console.log(JSON.stringify({
      tag: 'BM_AUDIT',
      fn: 'criarBMSemWizard',
      obra_id,
      contrato_versao_id: versaoAtiva.id,
      bm_id: bm.id,
      qtd_contrato_itens: contratoItems.length,
      qtd_bm_items: itensCount,
      total_contrato: versaoAtiva.total_contrato || 0,
      sample_contrato_item: contratoItems[0] ? {
        id: contratoItems[0].id,
        unidade: contratoItems[0].unidade,
        qtd_contrato: contratoItems[0].qtd_contrato,
        preco_unit_com_bdi: contratoItems[0].preco_unit_com_bdi
      } : null,
      sample_bm_item: 'created_inline_no_ref'
    }));

    return Response.json({
      ok: true,
      bm_id: bm.id,
      numero: bm.numero,
      obra_id: bm.obra_id,
      contrato_versao_id: bm.contrato_versao_id,
      status: bm.status,
      itens_criados: itensCount,
      versao_criada_automaticamente: versoes.length === 0,
      mensagem: `BM ${numero} criada com ${itensCount} itens.`
    });

  } catch (error) {
    console.error('[criarBMSemWizard] ERRO:', error?.message, error?.stack);
    return Response.json({ ok: false, error: error?.message || 'Erro ao criar BM' }, { status: 500 });
  }
});