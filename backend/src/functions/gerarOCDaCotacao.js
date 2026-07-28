import { store } from '../entityStore.js';

// Porte de gerarOCDaCotacao: cria a Ordem de Compra a partir da cotação
// vencedora, marca as demais cotações como recusadas e avança a requisição.
export default async function gerarOCDaCotacao({ body, user }) {
  const { requisicao_id, cotacao_id } = body || {};
  if (!requisicao_id || !cotacao_id) {
    throw Object.assign(new Error('requisicao_id e cotacao_id são obrigatórios'), { status: 400 });
  }

  const req = (await store.filter('RequisicaoCompra', { id: requisicao_id }))[0];
  if (!req) throw Object.assign(new Error('Requisição não encontrada'), { status: 404 });

  const cot = (await store.filter('CotacaoFornecedor', { id: cotacao_id }))[0];
  if (!cot) throw Object.assign(new Error('Cotação não encontrada'), { status: 404 });

  const numero = `OC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const oc = await store.create('OrdemCompra', {
    requisicao_id,
    cotacao_id,
    obra_id: req.obra_id || null,
    numero,
    fornecedor: cot.fornecedor || null,
    fornecedor_id: cot.fornecedor_id || null,
    valor_total: Number(cot.valor_total) || 0,
    prazo_entrega_dias: cot.prazo_entrega_dias || 0,
    condicoes_pagamento: cot.condicoes_pagamento || null,
    itens: cot.itens || req.itens || [],
    status: 'emitida',
    data_emissao: new Date().toISOString(),
    emitida_por: user?.email || null,
  }, user?.email || null);

  // Cotação vencedora -> selecionada; as demais -> recusada.
  await store.update('CotacaoFornecedor', cotacao_id, { status: 'selecionada' }).catch(() => {});
  const todas = (await store.filter('CotacaoFornecedor', { requisicao_id })) || [];
  for (const c of todas) {
    if (c.id !== cotacao_id) {
      await store.update('CotacaoFornecedor', c.id, { status: 'recusada' }).catch(() => {});
    }
  }

  // Avança a requisição para "em_compra".
  await store.update('RequisicaoCompra', requisicao_id, {
    status: 'em_compra',
    ordem_compra_id: oc.id,
    fornecedor_escolhido: cot.fornecedor || null,
    valor_compra: Number(cot.valor_total) || 0,
  }).catch(() => {});

  return { ok: true, oc_id: oc.id, ordem_compra: oc };
}
