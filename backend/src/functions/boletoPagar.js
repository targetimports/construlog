import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { registrarSaidaCaixa, ajustarVerbaEmpresa, empresaDaConta } from './tesourariaCore.js';

// CRUD + ações de Boletos a Pagar. Ações: criar | atualizar | pagar | cancelar.
const num = (v) => Number(v) || 0;
const hoje = () => new Date().toISOString().slice(0, 10);

export default async function boletoPagar({ body, user }) {
  requirePermission(user, 'FINANCEIRO_EDIT');
  const { action, id, data, motivo, data_pagamento, valor_pago, conta_tesouraria_id } = body || {};

  if (action === 'criar') {
    const rec = await store.create('BoletoPagar', {
      ...(data || {}),
      status: data?.status || 'ABERTO',
    }, user?.email || null);
    return { success: true, id: rec.id, boleto: rec };
  }

  if (action === 'atualizar') {
    if (!id) return { success: false, error: 'id é obrigatório' };
    const rec = await store.update('BoletoPagar', id, { ...(data || {}) });
    if (!rec) return { success: false, error: 'Boleto não encontrado' };
    return { success: true, boleto: rec };
  }

  if (action === 'pagar') {
    if (!id) return { success: false, error: 'id é obrigatório' };
    const b = (await store.filter('BoletoPagar', { id }))[0];
    if (!b) return { success: false, error: 'Boleto não encontrado' };
    if (b.status === 'PAGO') return { success: false, error: 'Boleto já está pago' };
    if (b.status === 'CANCELADO') return { success: false, error: 'Boleto cancelado' };

    const valorPago = num(valor_pago) || num(b.valor);
    const dataPag = data_pagamento || hoje();
    const contaTesId = conta_tesouraria_id || b.conta_tesouraria_id || null;

    // Baixa no caixa (corrige "pagar boleto não baixa o caixa").
    let movId = null;
    if (contaTesId) {
      const r = await registrarSaidaCaixa({
        conta_id: contaTesId, valor: valorPago, user,
        meta: {
          categoria: 'pagamento_boleto', descricao: `Boleto: ${b.descricao || b.beneficiario || b.fornecedor || ''}`.trim(),
          obra_id: b.obra_id || null, referencia_tipo: 'boleto', referencia_id: id, data: dataPag,
        },
      });
      if (r.error) return { success: false, error: r.error };
      movId = r.movimentacao_id;
    }

    await store.update('BoletoPagar', id, {
      status: 'PAGO', data_pagamento: dataPag, valor_pago: valorPago,
      conta_tesouraria_id: contaTesId, conciliacao_movimentacao_id: movId,
    });

    // O gasto consome a verba da empresa dona.
    const empresaId = await empresaDaConta(b);
    let saldoVerba = null;
    if (empresaId) {
      const rv = await ajustarVerbaEmpresa({ empresa_id: empresaId, delta: -valorPago, user });
      saldoVerba = rv.saldo_verba;
    }

    return { success: true, movimentacao_id: movId, empresa_id: empresaId, saldo_verba: saldoVerba };
  }

  if (action === 'cancelar') {
    if (!id) return { success: false, error: 'id é obrigatório' };
    const b = (await store.filter('BoletoPagar', { id }))[0];
    if (!b) return { success: false, error: 'Boleto não encontrado' };
    if (b.status === 'PAGO') return { success: false, error: 'Não é possível cancelar um boleto pago' };
    await store.update('BoletoPagar', id, { status: 'CANCELADO', motivo_cancelamento: motivo || null });
    return { success: true };
  }

  return { success: false, error: 'Ação inválida' };
}
