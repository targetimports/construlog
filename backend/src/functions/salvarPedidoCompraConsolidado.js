import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Salva (cria/atualiza) um Pedido de Compra e seus itens.
// Suporta pedido simples (1 obra) e consolidado (multi-obra com rateio).
// enviar=true → status ENVIADO; senão RASCUNHO.

const num = (v) => Number(v) || 0;

export default async function salvarPedidoCompraConsolidado({ body, user }) {
  requirePermission(user, 'COMPRAS_CREATE');
  const { pedido = {}, itens = [], enviar = false } = body || {};
  if (!pedido.fornecedor_id) {
    throw Object.assign(new Error('Fornecedor é obrigatório.'), { status: 400 });
  }
  const itensValidos = (Array.isArray(itens) ? itens : []).filter((i) => (i.material_id || i.insumo_id) && num(i.quantidade_pedida) > 0);
  if (itensValidos.length === 0) {
    throw Object.assign(new Error('Adicione pelo menos um item com material e quantidade.'), { status: 400 });
  }

  const valor_total = itensValidos.reduce(
    (s, i) => s + (num(i.total_item) || num(i.quantidade_pedida) * num(i.preco_unitario)),
    0,
  );

  // Toda compra é da MATRIZ (compra centralizada) — carimba empresa_id da matriz,
  // igual a converterSolicitacaoEmPedido, para o PC não nascer com empresa_id NULL.
  const matriz = (await store.filter('Empresa', { tipo: 'matriz' }))[0];

  const dados = {
    consolidado: !!pedido.consolidado,
    empresa_id: matriz?.id || null,
    fornecedor_id: pedido.fornecedor_id,
    fornecedor_nome: pedido.fornecedor_nome || '',
    obra_id: pedido.obra_id || null,
    obra_nome: pedido.obra_nome || '',
    obras_multi: pedido.obras_multi || [],
    data_pedido: pedido.data_pedido || new Date().toISOString().split('T')[0],
    previsao_entrega: pedido.previsao_entrega || null,
    condicao_pagamento: pedido.condicao_pagamento || '',
    observacao: pedido.observacao || '',
    valor_total,
    status: enviar ? 'ENVIADO' : 'RASCUNHO',
  };

  let saved;
  if (pedido.id) {
    saved = await store.update('PedidoCompra', pedido.id, dados);
    if (!saved) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
    // substitui os itens antigos
    const antigos = await store.filter('PedidoCompraItem', { pedido_id: pedido.id }, undefined, 1000);
    await Promise.all(antigos.map((it) => store.delete('PedidoCompraItem', it.id)));
  } else {
    const todos = await store.filter('PedidoCompra', {}, '-created_date', 100000);
    const ano = new Date().getFullYear();
    dados.numero = `PC-${ano}-${String(todos.length + 1).padStart(4, '0')}`;
    saved = await store.create('PedidoCompra', dados, user?.email || null);
  }

  for (const it of itensValidos) {
    const itemId = it.insumo_id || it.material_id || null; // catálogo único = Insumo
    await store.create('PedidoCompraItem', {
      pedido_id: saved.id,
      insumo_id: itemId,
      material_id: itemId, // alias compat
      material_nome: it.material_nome || it.insumo_nome || '',
      material_unidade: it.material_unidade || it.insumo_unidade || '',
      insumo_nome: it.material_nome || it.insumo_nome || '',
      insumo_unidade: it.material_unidade || it.insumo_unidade || '',
      quantidade_pedida: num(it.quantidade_pedida),
      preco_unitario: num(it.preco_unitario),
      total_item: num(it.total_item) || num(it.quantidade_pedida) * num(it.preco_unitario),
      rateio_obras: Array.isArray(it.rateio_obras) ? it.rateio_obras : [],
    }, user?.email || null);
  }

  return { ok: true, pedido: saved };
}
