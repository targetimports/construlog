/**
 * gerarVersaoAoAprovarAditivo: Motor de versionamento por aditivo
 * 
 * Ao aprovar um aditivo:
 * 1. Cria nova ContratoVersao com numero_versao incremental
 * 2. Copia ContratoItems com qtd_contrato = qtd_consolidada do aditivo
 * 3. Marca versão anterior como ARQUIVADA
 * 4. Vincula aditivo à nova versão (aditivo_origem_id)
 * 5. Registra auditoria
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

function TRUNC2(x) {
  if (x === null || x === undefined) return 0;
  const d = new Decimal(x);
  if (d.isZero()) return 0;
  const scaled = d.mul(100);
  const truncated = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return truncated.div(100).toNumber();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try {
      payload = await req.json();
    } catch (e) {
      // Safe JSON
    }

    const { aditivo_id } = payload;
    if (!aditivo_id) {
      return Response.json({ error: 'aditivo_id obrigatório' }, { status: 400 });
    }

    // Buscar aditivo
    const aditivos = await base44.asServiceRole.entities.Aditivo.filter({ id: aditivo_id }) || [];
    const aditivo = aditivos[0];
    if (!aditivo) {
      return Response.json({ error: 'Aditivo não encontrado' }, { status: 404 });
    }

    if (aditivo.status !== 'APROVADO') {
      return Response.json({ 
        error: 'Apenas aditivos APROVADOS podem gerar versão' 
      }, { status: 400 });
    }

    // Buscar versão origem
    const versoes = await base44.asServiceRole.entities.ContratoVersao.filter({
      id: aditivo.contrato_versao_origem_id
    }) || [];
    const versaoOrigem = versoes[0];
    if (!versaoOrigem) {
      return Response.json({ error: 'ContratoVersao origem não encontrada' }, { status: 404 });
    }

    // Buscar itens da versão origem
    const itensOrigem = await base44.asServiceRole.entities.ContratoItem.filter({
      contrato_versao_id: versaoOrigem.id
    }) || [];

    // Buscar AditivoItems para consolidação
    const aditivoItems = await base44.asServiceRole.entities.AditivoItem.filter({
      aditivo_id
    }) || [];
    const aditivoByItemId = Object.fromEntries(aditivoItems.map(ai => [ai.contrato_item_id, ai]));

    // Gerar número da nova versão
    const todasVersoes = await base44.asServiceRole.entities.ContratoVersao.filter({
      obra_id: aditivo.obra_id
    }) || [];
    const maxVersao = Math.max(...todasVersoes.map(v => v.numero_versao || 0));
    const novaVersaoNum = maxVersao + 1;

    // Calcular total contrato da nova versão
    let totalNovaVersao = new Decimal(0);
    for (const itemOrigem of itensOrigem) {
      const aditivoItem = aditivoByItemId[itemOrigem.id];
      const qtdConsolidada = aditivoItem?.qtd_consolidada || itemOrigem.qtd_contrato;
      const novoTotal = new Decimal(qtdConsolidada).mul(itemOrigem.preco_unit_com_bdi || itemOrigem.preco_unit || 0);
      totalNovaVersao = totalNovaVersao.add(novoTotal);
    }

    // Criar nova ContratoVersao
    const novaVersao = await base44.asServiceRole.entities.ContratoVersao.create({
      obra_id: aditivo.obra_id,
      numero_versao: novaVersaoNum,
      status: 'ATIVA',
      data_inicio_vigencia: new Date().toISOString().split('T')[0],
      bm_inicio_id: null, // Pode ser vinculado depois na 1ª BM
      total_contrato: TRUNC2(totalNovaVersao.toNumber()),
      aditivo_origem_id: aditivo_id,
    });

    // Copiar ContratoItems para nova versão
    const novoItens = [];
    for (const itemOrigem of itensOrigem) {
      const aditivoItem = aditivoByItemId[itemOrigem.id];
      
      const qtdConsolidada = aditivoItem?.qtd_consolidada || itemOrigem.qtd_contrato;
      const precoConsolidado = itemOrigem.preco_unit_com_bdi || itemOrigem.preco_unit || 0;
      const totalItem = TRUNC2(new Decimal(qtdConsolidada).mul(precoConsolidado).toNumber());

      const novoItem = await base44.asServiceRole.entities.ContratoItem.create({
        contrato_versao_id: novaVersao.id,
        item_codigo: itemOrigem.item_codigo,
        item_label: itemOrigem.item_label,
        descricao: itemOrigem.descricao,
        unidade: itemOrigem.unidade,
        qtd_contrato: qtdConsolidada,
        preco_unit: itemOrigem.preco_unit,
        preco_unit_sem_bdi: itemOrigem.preco_unit_sem_bdi,
        bdi_percent: itemOrigem.bdi_percent,
        preco_unit_com_bdi: precoConsolidado,
        preco_total: totalItem,
        parent_codigo: itemOrigem.parent_codigo,
        ordem: itemOrigem.ordem,
      });

      novoItens.push(novoItem);
    }

    // Arquivar versão anterior
    await base44.asServiceRole.entities.ContratoVersao.update(versaoOrigem.id, {
      status: 'ARQUIVADA',
    });

    // Registrar auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      obra_id: aditivo.obra_id,
      entidade: 'ContratoVersao',
      entidade_id: novaVersao.id,
      acao: 'create',
      usuario_id: user.email,
      observacao: `Versão gerada por aditivo ${aditivo.tipo} (ID: ${aditivo_id})`,
      dados_depois: {
        numero_versao: novaVersaoNum,
        aditivo_origem_id: aditivo_id,
        total_contrato: TRUNC2(totalNovaVersao.toNumber()),
      },
    });

    return Response.json({
      success: true,
      aditivo_id,
      versao_anterior_id: versaoOrigem.id,
      versao_nova_id: novaVersao.id,
      numero_versao_novo: novaVersaoNum,
      total_contrato_novo: TRUNC2(totalNovaVersao.toNumber()),
      itens_copiados: novoItens.length,
    });

  } catch (error) {
    console.error('[gerarVersaoAoAprovarAditivo]', error?.message);
    return Response.json({ 
      error: error?.message || 'Erro ao gerar versão' 
    }, { status: 500 });
  }
});