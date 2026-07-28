/**
 * calcContratoVersao: Calcula total de um contrato pela versão
 * 
 * Serviço central que consolida:
 * - ContratoItem por versão
 * - Cálculo de preco_total por item
 * - Total da versão
 * - Derivação automática de parent_codigo
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

function deriveParentCodigo(itemCodigo) {
  if (!itemCodigo) return null;
  const str = String(itemCodigo);
  const parts = str.split('.');
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join('.');
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
    
    const { contrato_versao_id } = payload;
    if (!contrato_versao_id) {
      return Response.json({ error: 'contrato_versao_id obrigatório' }, { status: 400 });
    }

    // Buscar versão
    const versoes = await base44.entities.ContratoVersao.filter({ id: contrato_versao_id }) || [];
    const versao = versoes[0];
    if (!versao) {
      return Response.json({ error: 'ContratoVersao não encontrado' }, { status: 404 });
    }

    // Buscar itens
    const itens = await base44.entities.ContratoItem.filter({ contrato_versao_id }) || [];

    // Calcular
    let totalContrato = new Decimal(0);
    const itensComParent = itens.map(item => {
      const qtd = new Decimal(item.qtd_contrato || 0);
      const pu = new Decimal(item.preco_unit_com_bdi || item.preco_unit || 0);
      const precoTotal = TRUNC2(qtd.mul(pu).toNumber());
      
      totalContrato = totalContrato.add(precoTotal);
      
      return {
        id: item.id,
        item_codigo: item.item_codigo,
        item_label: item.item_label,
        descricao: item.descricao,
        unidade: item.unidade,
        qtd_contrato: item.qtd_contrato,
        preco_unit: item.preco_unit,
        preco_unit_com_bdi: item.preco_unit_com_bdi,
        preco_total: precoTotal,
        parent_codigo: deriveParentCodigo(item.item_codigo),
      };
    });

    return Response.json({
      contrato_versao_id,
      numero_versao: versao.numero_versao,
      obra_id: versao.obra_id,
      status: versao.status,
      total_contrato: TRUNC2(totalContrato.toNumber()),
      itens_count: itensComParent.length,
      itens: itensComParent,
    });

  } catch (error) {
    console.error('[calcContratoVersao]', error?.message);
    return Response.json({ error: error?.message || 'Erro ao calcular contrato' }, { status: 500 });
  }
});