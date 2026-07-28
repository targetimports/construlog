import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Edita uma conta a receber. Não permite REMOVER obra_id (mas pode ficar ausente = mantém).
export default async function editarContaReceber({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');

  const { conta_id, ...dados } = body || {};
  if (!conta_id) return { ok: false, error: 'conta_id é obrigatório' };

  const conta = (await store.filter('ContaFinanceira', { id: conta_id }))[0];
  if (!conta) return { ok: false, error: 'Conta não encontrada' };
  if (conta.tipo !== 'receber') return { ok: false, error: 'Esta conta não é do tipo "receber"' };

  // Frontend pode enviar "vencimento" em vez de "data_vencimento".
  if (dados.vencimento && !dados.data_vencimento) {
    dados.data_vencimento = dados.vencimento;
    delete dados.vencimento;
  }

  // Bloqueia apenas tentativa explícita de remover obra_id (não quando simplesmente ausente).
  if ('obra_id' in dados && (dados.obra_id === null || dados.obra_id === '')) {
    return { ok: false, error: 'obra_id é obrigatório e não pode ser removido', field: 'obra_id' };
  }
  if (dados.obra_id && dados.obra_id !== conta.obra_id) {
    const obra = (await store.filter('Obra', { id: dados.obra_id }))[0];
    if (!obra) return { ok: false, error: 'Nova obra não encontrada', field: 'obra_id' };
    dados.obra_nome = obra.nome || '';
  }
  if (dados.valor !== undefined && Number(dados.valor) <= 0) {
    return { ok: false, error: 'Valor deve ser maior que zero' };
  }

  const camposPermitidos = [
    'descricao', 'valor', 'data_vencimento', 'obra_id', 'obra_nome',
    'fornecedor_cliente', 'cliente_id', 'categoria', 'forma_pagamento',
    'referencia_tipo', 'referencia_id', 'observacao', 'status',
  ];
  const patch = {};
  for (const campo of camposPermitidos) {
    if (dados[campo] !== undefined) patch[campo] = dados[campo];
  }
  if (patch.valor !== undefined) patch.valor = Number(patch.valor);

  await store.update('ContaFinanceira', conta_id, patch);
  return { ok: true, conta_id, message: 'Conta a receber atualizada com sucesso' };
}
