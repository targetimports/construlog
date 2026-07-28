import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { obra_id, criarBMInicial, gerarItensMedicao } = payload;

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Se nenhuma opção está marcada, apenas retornar sucesso
    if (!criarBMInicial && !gerarItensMedicao) {
      return Response.json({
        ok: true,
        bm_criada: false,
        itens_carregados: 0,
        mensagem: 'Nenhuma opção de medição foi selecionada. Você pode criar BM depois no módulo de Medições.'
      });
    }

    // Buscar obra
    const obrasFiltered = await base44.entities.Obra.filter({ id: obra_id }) || [];
    const obra = obrasFiltered[0];
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    let bm = null;
    let itensCarregados = 0;

    // 1) Criar BM inicial se solicitado
    if (criarBMInicial) {
      // Contar BMs existentes para gerar número
      const bmsExistentes = await base44.entities.BM.filter({ obra_id }) || [];
      const numero = (bmsExistentes.length || 0) + 1;

      // Obter contrato_versao_id da obra (se existir)
      let contratoVersaoId = null;
      if (obra.contrato_versao_id) {
        contratoVersaoId = obra.contrato_versao_id;
      } else {
        // Tentar buscar ContratoVersao ativa para a obra
        const versoes = await base44.entities.ContratoVersao.filter({
          obra_id,
          status: 'ATIVA'
        }) || [];
        if (versoes.length > 0) {
          contratoVersaoId = versoes[0].id;
        }
      }

      if (!contratoVersaoId) {
        return Response.json({
          ok: false,
          code: 'CONTRATO_SEM_VERSAO',
          error: 'Nenhuma versão de contrato ativa encontrada para a obra. Crie um contrato antes de inicializar BM.',
          bm_criada: false,
          itensCarregados: 0
        }, { status: 400 });
      }

      // ══════════════════════════════════════════════════════════════
      // BLOQUEIO ESTRUTURAL: ContratoVersao DEVE ter ContratoItem
      // ══════════════════════════════════════════════════════════════
      const contratoItemsCheck = await base44.entities.ContratoItem.filter({ contrato_versao_id: contratoVersaoId }) || [];
      console.log('[criarBMInicialDoWizard] GUARD: contrato_versao_id=' + contratoVersaoId + ' contratoItems=' + contratoItemsCheck.length);

      if (contratoItemsCheck.length === 0) {
        return Response.json({
          ok: false,
          code: 'CONTRATO_SEM_ITENS',
          error: 'Esta versão de contrato não possui itens. Cadastre os itens do contrato antes de criar uma medição.',
          bm_criada: false,
          itensCarregados: 0,
          contrato_versao_id: contratoVersaoId
        }, { status: 400 });
      }

      // Criar BM rascunho
      bm = await base44.entities.BM.create({
        obra_id,
        contrato_versao_id: contratoVersaoId,
        numero,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'RASCUNHO',
        total_contrato: 0,
        total_anterior: 0,
        total_periodo: 0,
        total_acumulado: 0,
        total_saldo: 0,
        percent_concluida: 0
      });
    }

    // 2) Pré-carregar itens se solicitado
    if (gerarItensMedicao && bm) {
      // Buscar itens do contrato vinculado à BM
      const contratoItems = await base44.entities.ContratoItem.filter({
        contrato_versao_id: bm.contrato_versao_id
      }) || [];

      if (contratoItems.length > 0) {
        // Criar BMItem para cada ContratoItem
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
              qtd_saldo: 0,
              vl_anterior: 0,
              vl_periodo: 0,
              vl_acumulado: 0,
              vl_saldo: 0
            });
            itensCarregados++;
          } catch (e) {
            console.warn(`[criarBMInicialDoWizard] Erro criando BMItem para contrato_item_id=${ci.id}:`, e.message);
          }
        }
      }
    }

    // ── BM_AUDIT ──
    const auditContratoItems = bm?.contrato_versao_id
      ? (await base44.entities.ContratoItem.filter({ contrato_versao_id: bm.contrato_versao_id }) || [])
      : [];
    console.log(JSON.stringify({
      tag: 'BM_AUDIT',
      fn: 'criarBMInicialDoWizard',
      obra_id,
      contrato_versao_id: bm?.contrato_versao_id || null,
      bm_id: bm?.id || null,
      qtd_contrato_itens: auditContratoItems.length,
      qtd_bm_items: itensCarregados,
      total_contrato: 0,
      sample_contrato_item: auditContratoItems[0] ? {
        id: auditContratoItems[0].id,
        unidade: auditContratoItems[0].unidade,
        qtd_contrato: auditContratoItems[0].qtd_contrato,
        preco_unit_com_bdi: auditContratoItems[0].preco_unit_com_bdi
      } : null
    }));

    return Response.json({
      ok: true,
      bm_criada: !!bm,
      bm_id: bm?.id || null,
      itens_carregados: itensCarregados,
      mensagem: `BM ${bm?.numero || 'N/A'} criada com ${itensCarregados} itens pré-carregados. Acesse o módulo de Medições para finalizar o controle.`
    });

  } catch (error) {
    console.error('[criarBMInicialDoWizard] erro:', error?.message);
    return Response.json({
      ok: false,
      error: error?.message || 'Erro ao criar BM inicial',
      bm_criada: false,
      itensCarregados: 0
    }, { status: 500 });
  }
});