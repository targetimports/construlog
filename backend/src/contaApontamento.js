import { store } from './entityStore.js';

// SINCRONIA PONTO → CONTA A PAGAR (diarista / terceirizado de diária).
//
// O buraco: ao APROVAR o apontamento nasce uma conta a pagar com o valor daquele
// dia. Se depois alguém corrigisse o dia (dia todo → meio período, ou → falta), as
// horas mudavam e a conta NÃO — o financeiro pagava um valor que não correspondia
// mais ao trabalhado, sem nenhum aviso.
//
// Regra (cliente, 2026-07-17):
//   • conta PENDENTE  → segue o ponto: recalcula o valor (meio período = meia
//                       diária) e, se o dia virou falta (valor 0), a conta é
//                       REMOVIDA — não faz sentido dever por um dia não trabalhado;
//   • conta PAGA      → não se mexe. Dinheiro que já saiu é fato consumado; o
//                       acerto é assunto do financeiro, não do ponto.
//
// Só age em conta gerada pelo próprio apontamento (referencia_tipo/id), então nunca
// encosta em lançamento feito à mão pelo financeiro.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

export const valorDoApontamento = (ap) =>
  r2(num(ap?.total) || num(ap?.valor_diaria) + num(ap?.total_horas_extra));

export async function sincronizarContaDoApontamento(ap) {
  if (!ap?.id) return null;

  const contas = (await store.filter('ContaFinanceira', {
    referencia_tipo: 'apontamento_mao_obra',
    referencia_id: ap.id,
  }).catch(() => [])) || [];
  const conta = contas.find((c) => c.status !== 'cancelado');
  if (!conta) return null; // dia nunca aprovado → não há dinheiro envolvido

  if (String(conta.status) === 'pago') {
    const valor = valorDoApontamento(ap);
    // Divergência real (o pago não bate mais com o dia) — a tela avisa; o valor
    // pago continua como está, por decisão de negócio.
    return {
      acao: 'mantida_paga',
      conta_id: conta.id,
      valor_pago: num(conta.valor),
      valor_atual: valor,
      divergente: Math.abs(num(conta.valor) - valor) > 0.005,
    };
  }

  const valor = valorDoApontamento(ap);

  if (valor <= 0) {
    await store.delete('ContaFinanceira', conta.id);
    return { acao: 'removida', conta_id: conta.id, valor_anterior: num(conta.valor) };
  }

  if (Math.abs(num(conta.valor) - valor) > 0.005) {
    await store.update('ContaFinanceira', conta.id, {
      valor,
      observacao: `Valor ajustado pela correção do ponto (${ap.data || ''}).`,
    });
    return { acao: 'ajustada', conta_id: conta.id, valor_anterior: num(conta.valor), valor };
  }

  return { acao: 'inalterada', conta_id: conta.id, valor };
}
