import { store } from '../entityStore.js';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Sincroniza/recalcula o resumo financeiro de uma obra a partir das contas já
// existentes (ContaFinanceira). Não cria nem altera contas — apenas consolida os
// totais. Usada após aprovar uma medição.
export default async function sincronizarMedicaoFinanceiro({ body }) {
  const obra_id = body?.obra_id;
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });

  const contas = (await store.filter('ContaFinanceira', { obra_id }).catch(() => [])) || [];
  const ativas = contas.filter((c) => c.status !== 'cancelado');

  const total_receber = ativas.filter((c) => c.tipo === 'receber').reduce((s, c) => s + num(c.valor), 0);
  const total_pagar = ativas.filter((c) => c.tipo === 'pagar').reduce((s, c) => s + num(c.valor), 0);
  const recebido = ativas.filter((c) => c.tipo === 'receber').reduce((s, c) => s + num(c.valor_recebido), 0);
  const pago = ativas.filter((c) => c.tipo === 'pagar').reduce((s, c) => s + num(c.valor_pago), 0);

  return {
    ok: true,
    obra_id,
    contas: ativas.length,
    total_receber,
    total_pagar,
    a_receber_pendente: total_receber - recebido,
    a_pagar_pendente: total_pagar - pago,
  };
}
