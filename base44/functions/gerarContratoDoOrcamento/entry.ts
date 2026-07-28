/**
 * gerarContratoDoOrcamento
 * 
 * Cria ContratoVersao + ContratoItem a partir do Orcamento + ItemOrcamento da obra.
 * Usado quando a obra tem orçamento importado mas ainda não tem contrato/versão.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    const obra_id = payload.obra_id;
    if (!obra_id) {
      return Response.json({ ok: false, error: 'obra_id obrigatório' }, { status: 400 });
    }

    console.log('[gerarContratoDoOrcamento] obra_id:', obra_id);

    // Verificar se já existe ContratoVersao ATIVA
    const versoesExistentes = await base44.entities.ContratoVersao.filter({ obra_id, status: 'ATIVA' });
    if (versoesExistentes.length > 0) {
      // Verificar se tem itens
      const itensExistentes = await base44.entities.ContratoItem.filter({ contrato_versao_id: versoesExistentes[0].id });
      if (itensExistentes.length > 0) {
        return Response.json({
          ok: true,
          already_exists: true,
          contrato_versao_id: versoesExistentes[0].id,
          itens_count: itensExistentes.length,
          message: 'ContratoVersao já existe com itens.'
        });
      }
      // Tem versão mas sem itens - vamos popular
      console.log('[gerarContratoDoOrcamento] Versão existe mas sem itens, populando...');
    }

    // Buscar orçamento da obra
    const orcamentos = await base44.entities.Orcamento.filter({ obra_id });
    if (!orcamentos.length) {
      return Response.json({ ok: false, error: 'Nenhum orçamento encontrado para esta obra.' }, { status: 400 });
    }
    const orcamento = orcamentos[0];
    console.log('[gerarContratoDoOrcamento] orcamento_id:', orcamento.id);

    // Buscar itens do orçamento
    const itensOrcamento = await base44.entities.ItemOrcamento.filter({ orcamento_id: orcamento.id });
    if (!itensOrcamento.length) {
      return Response.json({ ok: false, error: 'Orçamento não possui itens.' }, { status: 400 });
    }
    console.log('[gerarContratoDoOrcamento] itens_orcamento:', itensOrcamento.length);

    // Filtrar itens válidos (com quantidade > 0 e descrição real)
    const itensValidos = itensOrcamento.filter(it => {
      const desc = (it.descricao || '').trim();
      const isPlaceholder = desc.startsWith('____') || desc === '';
      const temQtd = (it.quantidade || 0) > 0;
      const temCusto = (it.custo_unitario || 0) > 0 || (it.custo_total || 0) > 0;
      return !isPlaceholder && (temQtd || temCusto);
    });
    console.log('[gerarContratoDoOrcamento] itens_validos:', itensValidos.length);

    if (itensValidos.length === 0) {
      return Response.json({ ok: false, error: 'Nenhum item válido no orçamento para gerar contrato.' }, { status: 400 });
    }

    // Buscar obra para total
    const obras = await base44.entities.Obra.filter({ id: obra_id });
    const obra = obras[0];

    // Criar ou reusar ContratoVersao
    let versao;
    if (versoesExistentes.length > 0) {
      versao = versoesExistentes[0];
    } else {
      const totalContrato = obra?.total_orcamento || itensValidos.reduce((s, it) => s + (it.custo_total || 0), 0);
      versao = await base44.entities.ContratoVersao.create({
        obra_id,
        numero_versao: 1,
        status: 'ATIVA',
        total_contrato: totalContrato
      });
      console.log('[gerarContratoDoOrcamento] ContratoVersao criada:', versao.id);
    }

    // Criar ContratoItem para cada item válido do orçamento
    let ordem = 1;
    let criados = 0;
    let erros = 0;
    let totalGerado = 0;

    for (const item of itensValidos) {
      try {
        const precoUnit = item.custo_unitario || 0;
        const qtd = item.quantidade || 0;
        const precoTotal = qtd * precoUnit;
        totalGerado += precoTotal;

        await base44.entities.ContratoItem.create({
          contrato_versao_id: versao.id,
          item_codigo: item.codigo || `${ordem}`,
          item_label: (item.descricao || '').substring(0, 80),
          descricao: item.descricao || '',
          unidade: item.unidade || 'un',
          qtd_contrato: qtd,
          preco_unit: precoUnit,
          preco_unit_com_bdi: precoUnit,
          preco_total: precoTotal,
          ordem: ordem
        });
        criados++;
        ordem++;
      } catch (e) {
        console.warn('[gerarContratoDoOrcamento] Erro item:', item.id, e.message);
        erros++;
      }
    }

    // Atualizar total do contrato
    if (totalGerado > 0) {
      await base44.entities.ContratoVersao.update(versao.id, { total_contrato: totalGerado });
    }

    // Audit
    await base44.entities.AuditLog.create({
      obra_id,
      entidade: 'ContratoVersao',
      entidade_id: versao.id,
      acao: 'create',
      dados_depois: { contrato_versao_id: versao.id, itens_criados: criados, total: totalGerado },
      usuario_id: user.email,
      observacao: `Contrato gerado a partir do orçamento ${orcamento.id} com ${criados} itens`
    });

    console.log('[gerarContratoDoOrcamento] OK:', { criados, erros, totalGerado });

    return Response.json({
      ok: true,
      contrato_versao_id: versao.id,
      itens_criados: criados,
      itens_erro: erros,
      total_contrato: totalGerado,
      message: `Contrato gerado com ${criados} itens a partir do orçamento.`
    });

  } catch (error) {
    console.error('[gerarContratoDoOrcamento] ERRO:', error?.message, error?.stack);
    return Response.json({ ok: false, error: error?.message || 'Erro ao gerar contrato' }, { status: 500 });
  }
});