import { store } from '../entityStore.js';

// RATEIO DA FROTA — custo de uso de veículo/máquina emprestado pela Matriz à obra.
//
// Decisão de negócio (cliente, 2026-07-20): o empréstimo de ativo entre empresas do
// grupo NÃO é uma cobrança de verdade — nenhum dinheiro troca de mãos. Antes a
// devolução gerava uma CONTA A PAGAR de "Matriz (frota do grupo)", o que inflava o
// Contas a Pagar da empresa-membro com uma dívida que ninguém ia pagar (e sem
// contrapartida a receber na Matriz, o grupo registrava despesa sem receita).
//
// Agora funciona igual ao rateio do mensalista: o custo NÃO vira título financeiro,
// é atribuído gerencialmente à obra que usou o equipamento. Quem compra, mantém e
// deprecia o ativo continua sendo a Matriz — o rateio só mostra onde ele foi usado.
//
// FONTE ÚNICA: o próprio EmprestimoAtivo (campo custo_total, gravado na devolução).
// Nada é duplicado em outra entidade, então não há como as duas versões divergirem.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

/**
 * Custo de frota rateado para uma obra no período.
 * Só empréstimos DEVOLVIDOS entram: enquanto o ativo está em uso não se sabe o uso
 * real (o medidor de retorno é lido na vistoria de devolução).
 */
export async function custoFrotaDaObra(obra_id, { de, ate } = {}) {
  if (!obra_id) return 0;
  const emps = await store.filter('EmprestimoAtivo', { obra_id }, '-data_retorno', 20000).catch(() => []);
  const dentro = (d) => (!de || (d && d >= de)) && (!ate || (d && d <= ate));
  return r2(
    emps
      .filter((e) => e.status === 'devolvido' && dentro(String(e.data_retorno || '').slice(0, 10)))
      .reduce((s, e) => s + num(e.custo_total), 0),
  );
}

/**
 * Mesma conta, em lote, para várias obras de uma vez (usado na DRE por empresa,
 * que percorre todas as obras — evita uma consulta por obra).
 */
export async function custoFrotaPorObra({ de, ate } = {}) {
  const emps = await store.filter('EmprestimoAtivo', {}, '-data_retorno', 100000).catch(() => []);
  const dentro = (d) => (!de || (d && d >= de)) && (!ate || (d && d <= ate));
  const mapa = {};
  for (const e of emps) {
    if (e.status !== 'devolvido' || !e.obra_id) continue;
    if (!dentro(String(e.data_retorno || '').slice(0, 10))) continue;
    mapa[e.obra_id] = r2((mapa[e.obra_id] || 0) + num(e.custo_total));
  }
  return mapa;
}
