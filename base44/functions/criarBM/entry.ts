import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const obra_id = body?.obra_id;
    const data_inicio = body?.data_inicio || null;
    const data_fim = body?.data_fim || null;

    if (!obra_id) return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });

    // 1) Obter versão ativa mais recente do contrato da obra
    const versoes = await base44.asServiceRole.entities.ContratoVersao.filter({ obra_id, status: 'ATIVA' });
    if (!versoes || versoes.length === 0) {
      return Response.json({ error: 'Nenhuma versão de contrato ATIVA para a obra' }, { status: 400 });
    }
    const versaoAtiva = [...versoes].sort((a,b) => (b.numero_versao||0) - (a.numero_versao||0))[0];

    // ══════════════════════════════════════════════════════════════
    // BLOQUEIO ESTRUTURAL: ContratoVersao DEVE ter ContratoItem
    // ══════════════════════════════════════════════════════════════
    const contratoItemsCheck = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id: versaoAtiva.id }) || [];
    console.log('[criarBM] GUARD: contrato_versao_id=' + versaoAtiva.id + ' contratoItems=' + contratoItemsCheck.length);

    if (contratoItemsCheck.length === 0) {
      return Response.json({
        code: 'CONTRATO_SEM_ITENS',
        error: 'Esta versão de contrato não possui itens. Cadastre os itens antes de criar uma medição.',
        contrato_versao_id: versaoAtiva.id,
        obra_id
      }, { status: 400 });
    }

    // 2) Descobrir próximo número de BM dentro desta versão
    const bmsDaVersao = await base44.asServiceRole.entities.BM.filter({ obra_id, contrato_versao_id: versaoAtiva.id });
    const proximoNumero = (bmsDaVersao || []).reduce((max, b) => Math.max(max, b?.numero || 0), 0) + 1;

    // 3) Criar BM em RASCUNHO vinculada à versão ATIVA
    const novaBM = await base44.asServiceRole.entities.BM.create({
      obra_id,
      contrato_versao_id: versaoAtiva.id,
      numero: proximoNumero,
      data_inicio,
      data_fim,
      status: 'RASCUNHO',
      total_contrato: versaoAtiva.total_contrato || 0,
      total_anterior: 0,
      total_periodo: 0,
      total_acumulado: 0,
      total_saldo: versaoAtiva.total_contrato || 0,
      percent_concluida: 0,
    });

    // 4) Auditoria
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        obra_id,
        entidade: 'BM',
        entidade_id: novaBM.id,
        acao: 'create',
        dados_depois: { numero: proximoNumero, contrato_versao_id: versaoAtiva.id, status: 'RASCUNHO' },
        usuario_id: user.email,
        observacao: 'BM criada vinculada à versão ativa do contrato',
      });
    } catch (err) {
      console.log('AuditLog criarBM falhou:', err?.message);
    }

    // ── BM_AUDIT ──
    console.log(JSON.stringify({
      tag: 'BM_AUDIT',
      fn: 'criarBM',
      obra_id,
      contrato_versao_id: versaoAtiva.id,
      bm_id: novaBM.id,
      qtd_contrato_itens: contratoItemsCheck.length,
      qtd_bm_items: 0,
      total_contrato: versaoAtiva.total_contrato || 0,
      sample_contrato_item: contratoItemsCheck[0] ? {
        id: contratoItemsCheck[0].id,
        unidade: contratoItemsCheck[0].unidade,
        qtd_contrato: contratoItemsCheck[0].qtd_contrato,
        preco_unit_com_bdi: contratoItemsCheck[0].preco_unit_com_bdi
      } : null
    }));

    return Response.json({ success: true, bm_id: novaBM.id, numero: proximoNumero, contrato_versao_id: versaoAtiva.id });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});