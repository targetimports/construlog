import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { registrarEntradaCaixa } from './tesourariaCore.js';

// Dá baixa (total ou parcial) em conta a receber.
// Convenção do sistema: receber liquidado => status 'recebido' + data_recebimento.
export default async function darBaixaRecebimento({ body, user }) {
  requirePermission(user, 'FINANCEIRO_APPROVE'); // aprovar recebimento = financeiro + admin/TI

  const {
    conta_id,
    data_recebimento,
    data_pagamento, // nome enviado pelo dialog atual
    valor_recebido,
    forma_pagamento,
    observacao = '',
  } = body || {};

  const dataReceb = data_recebimento || data_pagamento;

  if (!conta_id || !dataReceb || !valor_recebido || !forma_pagamento) {
    return { ok: false, error: 'Campos obrigatórios: conta_id, data_recebimento, valor_recebido, forma_pagamento' };
  }
  if (Number(valor_recebido) <= 0) return { ok: false, error: 'Valor recebido deve ser maior que zero' };

  const conta = (await store.filter('ContaFinanceira', { id: conta_id }))[0];
  if (!conta) return { ok: false, error: 'Conta não encontrada' };
  if (conta.tipo !== 'receber') return { ok: false, error: 'Esta conta não é do tipo "receber"' };

  const valorTotal = Number(conta.valor) || 0;
  const jaRecebido = Number(conta.valor_recebido) || 0;
  const novoTotal = jaRecebido + Number(valor_recebido);

  if (novoTotal > valorTotal + 0.001) {
    return { ok: false, error: `Valor recebido (${novoTotal.toFixed(2)}) excede o valor total da conta (${valorTotal.toFixed(2)})` };
  }

  let novoStatus = 'pendente';
  if (novoTotal >= valorTotal - 0.001) novoStatus = 'recebido';
  else if (novoTotal > 0) novoStatus = 'parcial';

  const historico = Array.isArray(conta.historico_baixas) ? [...conta.historico_baixas] : [];
  historico.push({
    data: new Date().toISOString(),
    valor: Number(valor_recebido),
    forma_pagamento,
    responsavel: user?.email || '',
    observacao,
  });

  const patch = {
    valor_recebido: novoTotal,
    status: novoStatus,
    forma_pagamento,
    historico_baixas: historico,
    observacao: observacao || conta.observacao,
  };
  if (novoStatus === 'recebido') patch.data_recebimento = String(dataReceb).slice(0, 10);

  await store.update('ContaFinanceira', conta_id, patch);

  // Crédito no caixa: o recebimento entra na conta de tesouraria escolhida (se informada).
  // Recebimento é receita — NÃO mexe na verba (que é o orçamento de gasto da empresa).
  let movId = null;
  const contaTesId = body?.conta_tesouraria_id || null;
  if (contaTesId) {
    const r = await registrarEntradaCaixa({
      conta_id: contaTesId, valor: Number(valor_recebido), user,
      meta: {
        categoria: 'recebimento', descricao: `Recebimento: ${conta.descricao || ''}`.trim(),
        obra_id: conta.obra_id || null, referencia_tipo: 'conta_financeira', referencia_id: conta_id, data: String(dataReceb).slice(0, 10),
      },
    });
    if (r.error) return { ok: false, error: r.error };
    movId = r.movimentacao_id;
    await store.update('ContaFinanceira', conta_id, {
      conta_tesouraria_id: contaTesId, conciliacao_movimentacao_id: movId, conciliado: true, data_conciliacao: String(dataReceb).slice(0, 10),
    });
  }

  const restante = valorTotal - novoTotal;
  return {
    ok: true,
    conta_id,
    movimentacao_id: movId,
    status_anterior: conta.status,
    status_novo: novoStatus,
    valor_recebido: Number(valor_recebido),
    valor_total_recebido: novoTotal,
    valor_restante: restante,
    message: novoStatus === 'recebido'
      ? 'Recebimento total confirmado'
      : `Recebimento parcial registrado. Restante: R$ ${restante.toFixed(2)}`,
  };
}
