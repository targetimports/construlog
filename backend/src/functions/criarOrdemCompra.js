import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Cria uma Ordem de Compra a partir de itens (insumo + qtd + valor), calculando
// subtotal, impostos e total. Status inicial: criada / não pago / não recebido.
export default async function criarOrdemCompra({ body, user }) {
  const {
    numero, fornecedor_id, itens, obra_id,
    data_emissao, data_prevista_entrega, condicoes_pagamento,
    destino = 'estoque_central', observacoes
  } = body || {};

  // Validação de entrada
  if (!numero) throw Object.assign(new Error('numero é obrigatório'), { status: 400 });
  if (!fornecedor_id) throw Object.assign(new Error('fornecedor_id é obrigatório'), { status: 400 });
  if (!Array.isArray(itens) || itens.length === 0) {
    throw Object.assign(new Error('itens deve ser um array com ao menos 1 item'), { status: 400 });
  }
  for (const item of itens) {
    if (!item.insumo_id) throw Object.assign(new Error('Todos os itens devem ter insumo_id'), { status: 400 });
  }

  // Permissão (super admin passa direto)
  requirePermission(user, 'COMPRAS_CREATE');

  // Valida que os insumos existem
  for (const item of itens) {
    const insumos = await store.filter('Insumo', { id: item.insumo_id }, null, 1);
    if (!insumos || insumos.length === 0) {
      throw Object.assign(new Error(`Insumo ${item.insumo_id} não encontrado`), { status: 404 });
    }
  }

  // Calcula totais
  let valor_subtotal = 0;
  let valor_impostos = 0;
  const itensProcessados = itens.map((item) => {
    const valor_item = (item.quantidade_solicitada || 0) * (item.valor_unitario || 0);
    const imposto = valor_item * ((item.impostos_percentual || 0) / 100);
    valor_subtotal += valor_item;
    valor_impostos += imposto;
    return { ...item, valor_total: valor_item, impostos_valor: imposto };
  });
  const valor_total = valor_subtotal + valor_impostos;

  const fornecedores = await store.filter('Fornecedor', { id: fornecedor_id }, null, 1);
  const fornecedor = fornecedores?.[0];

  const oc = await store.create('OrdemCompra', {
    numero,
    fornecedor_id,
    fornecedor_nome: fornecedor?.nome || '',
    obra_id: obra_id || null,
    itens: itensProcessados,
    valor_subtotal,
    valor_impostos,
    valor_total,
    data_emissao: data_emissao || new Date().toISOString().split('T')[0],
    data_prevista_entrega,
    condicoes_pagamento,
    status: 'criada',
    destino,
    observacoes,
    status_pagamento: 'nao_pago',
    status_entrega: 'nao_recebido'
  });

  return { oc_id: oc.id, numero: oc.numero, status: 'criada', valor_total, total_itens: itens.length };
}
