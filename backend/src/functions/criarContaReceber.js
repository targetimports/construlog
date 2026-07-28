import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Cria uma conta a receber. Regra de negócio: obra_id é obrigatório.
export default async function criarContaReceber({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');

  const p = body || {};

  if (!p.obra_id) return { ok: false, error: 'obra_id é obrigatório para contas a receber', field: 'obra_id' };
  if (!p.descricao || !p.valor || !p.data_vencimento) {
    return { ok: false, error: 'Campos obrigatórios: descricao, valor, data_vencimento, obra_id' };
  }
  if (Number(p.valor) <= 0) return { ok: false, error: 'Valor deve ser maior que zero' };

  const obra = (await store.filter('Obra', { id: p.obra_id }))[0];
  if (!obra) return { ok: false, error: 'Obra não encontrada', field: 'obra_id' };

  const conta = await store.create('ContaFinanceira', {
    tipo: 'receber',
    obra_id: p.obra_id,
    obra_nome: obra.nome || '',
    descricao: p.descricao,
    valor: Number(p.valor),
    data_vencimento: p.data_vencimento,
    fornecedor_cliente: p.fornecedor_cliente || '',
    cliente_id: p.cliente_id || null,
    categoria: p.categoria || 'outros',
    forma_pagamento: p.forma_pagamento || null,
    referencia_tipo: p.referencia_tipo || null,
    referencia_id: p.referencia_id || null,
    observacao: p.observacao || null,
    status: 'pendente',
    valor_recebido: 0,
    historico_baixas: [],
  }, user?.email);

  return { ok: true, conta, message: 'Conta a receber criada com sucesso' };
}
