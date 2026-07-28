/**
 * auditoriaContrato — Audita a persistência do Orçamento Sintético importado
 * como base oficial do Contrato/BM.
 *
 * Entidades auditadas (ordem de busca):
 *   1. ContratoVersao  (obra_id, status)
 *   2. ContratoItem    (contrato_versao_id, item_codigo, unidade, qtd_contrato, preco_unit_com_bdi)
 *
 * Uso:
 *   POST { obra_id }
 *   ou
 *   POST { obra_id, contrato_versao_id }   ← força uma versão específica
 *   ou
 *   POST { obra_id, test: true }           ← inclui amostra de 5 itens
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const normCodigo = (x) => String(x ?? '').trim().toUpperCase();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    const { obra_id, contrato_versao_id: forceVersaoId } = payload;

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // ─── 1. Verificar Obra ────────────────────────────────────────────────────
    const obras = await base44.asServiceRole.entities.Obra.filter({ id: obra_id }) || [];
    const obra = obras[0];
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada', obra_id }, { status: 404 });
    }

    // ─── 2. Buscar ContratoVersao(ões) ────────────────────────────────────────
    let versoes = [];
    if (forceVersaoId) {
      versoes = await base44.asServiceRole.entities.ContratoVersao.filter({ id: forceVersaoId }) || [];
    } else {
      versoes = await base44.asServiceRole.entities.ContratoVersao.filter({ obra_id }) || [];
    }

    // Separar ativa e arquivadas
    const versaoAtiva   = versoes.find(v => v.status === 'ATIVA') || versoes[0] || null;
    const todasVersoes  = versoes.map(v => ({
      id: v.id,
      numero_versao: v.numero_versao,
      status: v.status,
      total_contrato: v.total_contrato
    }));

    if (!versaoAtiva) {
      return Response.json({
        ok: false,
        obra_id,
        obra_nome: obra.nome,
        contrato_versao_id: null,
        apto_para_bm: false,
        diagnostico: 'Nenhuma ContratoVersao encontrada para esta obra.',
        versoes_encontradas: todasVersoes,
        itens_total: 0
      });
    }

    const contrato_versao_id = versaoAtiva.id;

    // ─── 3. Buscar ContratoItems ───────────────────────────────────────────────
    const itens = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id }) || [];

    // ─── 4. Métricas de qualidade ─────────────────────────────────────────────
    let itens_sem_codigo   = 0;
    let itens_sem_unidade  = 0;
    let itens_qtd_zero     = 0;
    let itens_preco_zero   = 0;
    let itens_validos      = 0;
    const codigoNormMap    = {};

    for (const item of itens) {
      const codigo    = String(item.item_codigo ?? '').trim();
      const unidade   = String(item.unidade ?? '').trim();
      const qtd       = Number(item.qtd_contrato) || 0;
      const preco     = Number(item.preco_unit_com_bdi || item.preco_unit) || 0;

      if (!codigo)   itens_sem_codigo++;
      if (!unidade)  itens_sem_unidade++;
      if (qtd <= 0)  itens_qtd_zero++;
      if (preco <= 0) itens_preco_zero++;

      const isValido = codigo && unidade && qtd > 0 && preco > 0;
      if (isValido) itens_validos++;

      // contagem de duplicados por código normalizado
      const cn = normCodigo(codigo);
      if (cn) codigoNormMap[cn] = (codigoNormMap[cn] || 0) + 1;
    }

    const duplicados_por_codigo_norm = Object.entries(codigoNormMap)
      .filter(([, count]) => count > 1)
      .map(([codigo_norm, count]) => ({ codigo_norm, count }))
      .sort((a, b) => b.count - a.count);

    // ─── 5. Amostra de 5 itens ────────────────────────────────────────────────
    const amostra_itens = itens.slice(0, 5).map(item => ({
      id:             item.id,
      codigo:         item.item_codigo,
      codigo_norm:    normCodigo(item.item_codigo),
      descricao:      item.descricao,
      unidade:        item.unidade,
      qtd_contrato:   item.qtd_contrato,
      preco_unit:     item.preco_unit,
      preco_unit_com_bdi: item.preco_unit_com_bdi,
      preco_total:    item.preco_total,
      parent_codigo:  item.parent_codigo,
      obra_id_no_item: item.obra_id ?? '⚠️ ausente'
    }));

    // ─── 6. BMs existentes para a versão ─────────────────────────────────────
    const bms = await base44.asServiceRole.entities.BM.filter({
      obra_id,
      contrato_versao_id,
    }) || [];

    const bm_resumo = bms.map(b => ({
      id: b.id,
      numero: b.numero,
      status: b.status,
      total_periodo: b.total_periodo,
      total_acumulado: b.total_acumulado
    }));

    const apto_para_bm = itens.length > 0 && itens_validos > 0;

    // ─── 7. Log no console (para debug no painel de funções) ─────────────────
    console.log('[auditoriaContrato]', JSON.stringify({
      obra_id,
      obra_nome: obra.nome,
      contrato_versao_id,
      itens_total: itens.length,
      itens_validos,
      itens_sem_codigo,
      itens_sem_unidade,
      itens_qtd_zero,
      itens_preco_zero,
      duplicados: duplicados_por_codigo_norm.length,
      apto_para_bm
    }));

    return Response.json({
      ok: true,
      obra_id,
      obra_nome: obra.nome,
      contrato_versao_id,
      versao_numero: versaoAtiva.numero_versao,
      versao_status: versaoAtiva.status,
      total_contrato_versao: versaoAtiva.total_contrato,
      todas_versoes: todasVersoes,

      // Métricas de itens
      itens_total:        itens.length,
      itens_validos,
      itens_sem_codigo,
      itens_sem_unidade,
      itens_qtd_zero,
      itens_preco_zero,
      duplicados_por_codigo_norm,

      // Aptidão para BM
      apto_para_bm,
      diagnostico: apto_para_bm
        ? `✅ Contrato apto: ${itens_validos}/${itens.length} itens válidos`
        : `❌ Contrato NÃO apto: ${itens_validos} itens válidos de ${itens.length} total`,

      // BMs existentes
      bms_encontradas: bms.length,
      bm_resumo,

      // Amostra
      amostra_itens
    });

  } catch (error) {
    console.error('[auditoriaContrato]', error?.message);
    return Response.json({
      ok: false,
      error: error?.message || 'Erro na auditoria'
    }, { status: 500 });
  }
});