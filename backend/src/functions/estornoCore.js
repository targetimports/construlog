import { store } from '../entityStore.js';
import { registrarEntradaCaixa, registrarSaidaCaixa, ajustarVerbaEmpresa, empresaDaConta } from './tesourariaCore.js';

// ESTORNO de uma ContaFinanceira que JÁ mexeu em dinheiro.
//
// O problema que resolve: cancelar ou excluir uma conta PAGA tirava a conta da
// tela, mas o dinheiro já debitado do caixa e da verba nunca voltava — o saldo
// ficava achatado para sempre. Aqui desfazemos exatamente o que pagar/receber
// fizeram, na direção contrária.
//
// Princípio: lançamos um movimento CONTRÁRIO no extrato (entrada estorna saída e
// vice-versa) em vez de apagar o movimento original. O caixa volta ao valor certo
// e a auditoria continua vendo que houve pagamento e depois estorno.

const num = (v) => Number(v) || 0;

// Uma conta "mexeu em dinheiro" quando foi paga/recebida (total ou parcial).
export function contaMovimentouDinheiro(rec) {
  const s = String(rec?.status || '').toLowerCase();
  if (rec?.tipo === 'pagar') return s === 'pago' || s === 'parcial';
  if (rec?.tipo === 'receber') return s === 'recebido' || s === 'parcial';
  return false;
}

// Desfaz o efeito financeiro de uma conta paga/recebida.
// Retorna { ok, caixa?, verba?, motivo? } — best-effort, nunca lança.
export async function estornarContaFinanceira(rec, { user, motivo = 'estorno' } = {}) {
  if (!rec || !contaMovimentouDinheiro(rec)) return { ok: false, motivo: 'sem_movimento' };

  const contaTesId = rec.conta_tesouraria_id || null;
  const resultado = { ok: true };

  if (rec.tipo === 'pagar') {
    // Pagar debitou o caixa e consumiu a verba → devolvemos os dois.
    const valor = num(rec.valor_pago) || num(rec.valor);
    if (contaTesId && valor > 0) {
      const r = await registrarEntradaCaixa({
        conta_id: contaTesId, valor, user,
        meta: {
          categoria: 'estorno', descricao: `Estorno (${motivo}): ${rec.descricao || rec.fornecedor_cliente || ''}`.trim(),
          obra_id: rec.obra_id || null, referencia_tipo: 'conta_financeira_estorno', referencia_id: rec.id, data: new Date().toISOString().slice(0, 10),
        },
      }).catch((e) => ({ error: e.message }));
      resultado.caixa = r?.error ? { erro: r.error } : { devolvido: valor, movimentacao_id: r?.movimentacao_id };
    }
    const empresaId = await empresaDaConta(rec).catch(() => null);
    if (empresaId && valor > 0) {
      const rv = await ajustarVerbaEmpresa({ empresa_id: empresaId, delta: +valor, user }).catch(() => null);
      resultado.verba = rv?.ok ? { devolvido: valor, saldo_verba: rv.saldo_verba } : null;
    }
  } else if (rec.tipo === 'receber') {
    // Receber creditou o caixa (e NÃO tocou verba) → tiramos o que entrou.
    const valor = num(rec.valor_recebido) || num(rec.valor);
    if (contaTesId && valor > 0) {
      const r = await registrarSaidaCaixa({
        conta_id: contaTesId, valor, user,
        meta: {
          categoria: 'estorno', descricao: `Estorno (${motivo}): ${rec.descricao || rec.fornecedor_cliente || ''}`.trim(),
          obra_id: rec.obra_id || null, referencia_tipo: 'conta_financeira_estorno', referencia_id: rec.id, data: new Date().toISOString().slice(0, 10),
        },
      }).catch((e) => ({ error: e.message }));
      resultado.caixa = r?.error ? { erro: r.error } : { retirado: valor, movimentacao_id: r?.movimentacao_id };
    }
  }

  return resultado;
}
