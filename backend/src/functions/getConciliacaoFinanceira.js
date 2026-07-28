import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Conciliação financeira: cruza contas liquidadas (pago/recebido) com movimentações de
// tesouraria, sugere matches automáticos (mesmo valor, direção e data próxima) e devolve KPIs.
const num = (x) => Number(x) || 0;
const r2 = (x) => Math.round(num(x) * 100) / 100;
const dataDe = (c) => c.data_pagamento || c.data_recebimento || c.data_vencimento || null;
const diffDias = (a, b) => {
  if (!a || !b) return 9999;
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
};

export default async function getConciliacaoFinanceira({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const obraId = body?.obra_id || null;

  let contas = await store.filter('ContaFinanceira', obraId ? { obra_id: obraId } : {}, '-data_vencimento', 5000);
  let movs = await store.filter('MovimentacaoTesouraria', obraId ? { obra_id: obraId } : {}, '-data_movimentacao', 5000);

  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    contas = contas.filter((c) => c.empresa_id === eid);
    movs = movs.filter((m) => m.empresa_id === eid);
  }

  const liquid = contas.filter((c) => c.status === 'pago' || c.status === 'recebido');
  const movUsadas = new Set(liquid.filter((c) => c.conciliacao_movimentacao_id).map((c) => c.conciliacao_movimentacao_id));

  const sugestoes = [];
  for (const c of liquid) {
    if (c.conciliado) continue;
    const dir = c.tipo === 'pagar' ? 'saida' : 'entrada';
    const cd = dataDe(c);
    const m = movs.find((mv) =>
      !movUsadas.has(mv.id) &&
      mv.tipo === dir &&
      Math.abs(num(mv.valor) - num(c.valor)) < 0.01 &&
      diffDias(mv.data_movimentacao, cd) <= 3
    );
    if (m) {
      sugestoes.push({
        conta_id: c.id, conta_descricao: c.descricao, conta_tipo: c.tipo, valor: r2(c.valor), data: cd,
        movimentacao_id: m.id, mov_descricao: m.descricao, mov_data: m.data_movimentacao,
      });
      movUsadas.add(m.id);
    }
  }

  const totalVal = r2(liquid.reduce((s, c) => s + num(c.valor), 0));
  const conciliadoVal = r2(liquid.filter((c) => c.conciliado).reduce((s, c) => s + num(c.valor), 0));
  const conciliadoCount = liquid.filter((c) => c.conciliado).length;

  return {
    kpis: {
      total_liquidado: totalVal,
      total_count: liquid.length,
      conciliado_valor: conciliadoVal,
      conciliado_count: conciliadoCount,
      pendente_valor: r2(totalVal - conciliadoVal),
      pendente_count: liquid.length - conciliadoCount,
      percentual: totalVal > 0 ? Math.round((conciliadoVal / totalVal) * 100) : 0,
    },
    contas: liquid.map((c) => ({
      id: c.id, tipo: c.tipo, descricao: c.descricao, fornecedor_cliente: c.fornecedor_cliente || '',
      valor: r2(c.valor), data: dataDe(c), status: c.status, obra_nome: c.obra_nome || '',
      conciliado: !!c.conciliado, conciliacao_movimentacao_id: c.conciliacao_movimentacao_id || null,
    })),
    movimentacoes: movs.map((m) => ({
      id: m.id, tipo: m.tipo, descricao: m.descricao, valor: r2(m.valor),
      data: m.data_movimentacao, categoria: m.categoria || '', forma_pagamento: m.forma_pagamento || '',
      conciliado: movUsadas.has(m.id) || !!m.conciliado,
    })),
    sugestoes,
  };
}
