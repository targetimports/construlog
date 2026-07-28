import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Decimal from 'npm:decimal.js@10.4.3';

// TRUNC2: trunca para 2 casas em direção a zero (sem arredondar)
function TRUNC2(x) {
  const d = new Decimal(x);
  const scaled = d.mul(100);
  const t = scaled.isNeg() ? scaled.ceil() : scaled.floor();
  return t.div(100);
}

function getParentCodigo(itemCodigo) {
  if (!itemCodigo || typeof itemCodigo !== 'string') return null;
  const idx = itemCodigo.lastIndexOf('.');
  if (idx === -1) return null; // item de topo
  return itemCodigo.substring(0, idx);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const contratoVersaoId = body?.contrato_versao_id;
    const persist = Boolean(body?.persist);

    if (!contratoVersaoId) {
      return Response.json({ error: 'contrato_versao_id é obrigatório' }, { status: 400 });
    }

    // Validar versão do contrato
    const versoes = await base44.asServiceRole.entities.ContratoVersao.filter({ id: contratoVersaoId });
    const versao = versoes?.[0];
    if (!versao) return Response.json({ error: 'ContratoVersao não encontrado' }, { status: 404 });

    // Carregar itens
    const itens = await base44.asServiceRole.entities.ContratoItem.filter({ contrato_versao_id: contratoVersaoId });

    let sum = new Decimal(0);
    const outItems = [];

    for (const it of itens) {
      const qtd = new Decimal(it?.qtd_contrato || 0);
      const pu = new Decimal(
        it?.preco_unit_com_bdi != null ? it.preco_unit_com_bdi : (it?.preco_unit != null ? it.preco_unit : 0)
      );

      // preco_total_item = TRUNC2(qtd_contrato * preco_unit_com_bdi)
      const precoTotalDec = qtd.mul(pu);
      const preco_total = TRUNC2(precoTotalDec).toNumber();

      sum = sum.add(new Decimal(preco_total));

      const parent_codigo = getParentCodigo(it?.item_codigo);

      outItems.push({
        id: it.id,
        item_codigo: it.item_codigo,
        parent_codigo,
        preco_total,
      });

      if (persist) {
        await base44.asServiceRole.entities.ContratoItem.update(it.id, {
          preco_total,
          parent_codigo,
        });
      }
    }

    // total_contrato = soma dos preco_total_item (itens já truncados)
    const total_contrato = TRUNC2(sum).toNumber();

    if (persist) {
      await base44.asServiceRole.entities.ContratoVersao.update(contratoVersaoId, { total_contrato });
    }

    // Estrutura para futura agregação por prefixo
    const group_by_parent = {};
    for (const it of outItems) {
      const key = it.parent_codigo || '__root__';
      if (!group_by_parent[key]) group_by_parent[key] = [];
      group_by_parent[key].push(it.id);
    }

    return Response.json({
      contrato_versao_id: contratoVersaoId,
      total_contrato,
      items: outItems,
      groups: {
        by_parent: group_by_parent,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});