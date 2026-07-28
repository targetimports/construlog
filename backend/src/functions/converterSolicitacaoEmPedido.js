import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Converte uma Solicitação de Compra (SC) APROVADA em um Pedido de Compra (PC).
// Conserta o elo SC→PC que antes morria na aprovação.
//
// Multi-empresa: a SC pertence à empresa-membro (quem pediu). O PEDIDO é sempre
// da MATRIZ — toda compra do grupo é centralizada (compra no CNPJ do grupo, entra
// no estoque Central). Por isso o PC é carimbado com empresa_id = matriz e guarda
// solicitacao_id/obra_id só como referência de origem.
//
// Idempotente: se a SC já foi convertida, devolve o pedido existente.

const num = (v) => Number(v) || 0;

export default async function converterSolicitacaoEmPedido({ body, user }) {
  requirePermission(user, 'COMPRAS_CREATE');
  const { solicitacao_id } = body || {};
  if (!solicitacao_id) throw Object.assign(new Error('Solicitação não informada.'), { status: 400 });

  const sc = (await store.filter('SolicitacaoCompra', { id: solicitacao_id }))[0];
  if (!sc) throw Object.assign(new Error('Solicitação não encontrada.'), { status: 404 });

  // Idempotência: já convertida → devolve o pedido existente.
  if (sc.pedido_id) {
    const jaExiste = (await store.filter('PedidoCompra', { id: sc.pedido_id }))[0];
    if (jaExiste) return { ok: true, pedido: jaExiste, ja_convertida: true };
  }
  if (String(sc.status || '').toUpperCase() === 'REPROVADA') {
    throw Object.assign(new Error('Solicitação reprovada não pode virar pedido.'), { status: 400 });
  }

  const itens = await store.filter('SolicitacaoCompraItem', { solicitacao_id: sc.id }, undefined, 1000);
  const itensValidos = (itens || []).filter((i) => (i.material_id || i.insumo_id) && num(i.quantidade) > 0);
  if (itensValidos.length === 0) {
    throw Object.assign(new Error('A solicitação não tem itens válidos para gerar o pedido.'), { status: 400 });
  }

  // Matriz (dona da compra centralizada).
  const matriz = (await store.filter('Empresa', { tipo: 'matriz' }))[0];
  const matrizId = matriz?.id || null;

  // Numeração PC-{ano}-{seq} (mesmo padrão de salvarPedidoCompraConsolidado).
  const todos = await store.filter('PedidoCompra', {}, '-created_date', 100000);
  const ano = new Date().getFullYear();
  const numero = `PC-${ano}-${String(todos.length + 1).padStart(4, '0')}`;

  const pedido = await store.create('PedidoCompra', {
    numero,
    empresa_id: matrizId, // toda compra é da Matriz
    origem: 'solicitacao',
    solicitacao_id: sc.id,
    solicitacao_numero: sc.numero || null,
    consolidado: false,
    fornecedor_id: null,
    fornecedor_nome: '',
    obra_id: sc.obra_id || null, // obra de origem (referência)
    obra_nome: sc.obra_nome || '',
    obras_multi: [],
    data_pedido: new Date().toISOString().split('T')[0],
    previsao_entrega: null,
    condicao_pagamento: '',
    observacao: sc.observacao || `Gerado da solicitação ${sc.numero || sc.id.slice(0, 8)}`,
    valor_total: 0,
    status: 'RASCUNHO',
  }, user?.email || null);

  for (const it of itensValidos) {
    const itemId = it.insumo_id || it.material_id || null;
    await store.create('PedidoCompraItem', {
      pedido_id: pedido.id,
      empresa_id: matrizId,
      insumo_id: itemId,
      material_id: itemId, // alias compat
      material_nome: it.material_nome || it.insumo_nome || '',
      material_unidade: it.material_unidade || it.insumo_unidade || '',
      insumo_nome: it.material_nome || it.insumo_nome || '',
      insumo_unidade: it.material_unidade || it.insumo_unidade || '',
      quantidade_pedida: num(it.quantidade),
      preco_unitario: 0,
      total_item: 0,
      quantidade_recebida: 0,
      solicitacao_item_id: it.id,
      rateio_obras: [],
    }, user?.email || null);
  }

  await store.update('SolicitacaoCompra', sc.id, {
    status: 'CONVERTIDA',
    pedido_id: pedido.id,
    pedido_numero: numero,
    convertida_em: new Date().toISOString(),
    convertida_por: user?.email || null,
  });

  return { ok: true, pedido, itens: itensValidos.length };
}
