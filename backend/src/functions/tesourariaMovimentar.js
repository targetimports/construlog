import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { escopoEmpresaDe } from '../escopoObra.js';

// Tesouraria (Caixa & Bancos). Ações:
//   get_resumo | get_fluxo_projetado | criar_conta | movimentar | bloquear_saldo_inicial
// Opera sobre ContaTesouraria (saldos) e MovimentacaoTesouraria (extrato).

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const hoje = () => new Date().toISOString().slice(0, 10);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

async function contasAtivasComTotais(eid) {
  const filtro = eid ? { empresa_id: eid } : {};
  const contas = (await store.filter('ContaTesouraria', filtro, '-created_date', 5000).catch(() => []))
    .filter((c) => !c.status || c.status === 'ativa');
  const movs = await store.filter('MovimentacaoTesouraria', filtro, '-data_movimentacao', 50000).catch(() => []);
  const totE = {}, totS = {};
  for (const m of movs) {
    if (m.tipo === 'entrada') totE[m.conta_id] = num(totE[m.conta_id]) + num(m.valor);
    else if (m.tipo === 'saida' || m.tipo === 'transferencia') totS[m.conta_id] = num(totS[m.conta_id]) + num(m.valor);
  }
  return contas.map((c) => ({ ...c, total_entradas: r2(totE[c.id] || 0), total_saidas: r2(totS[c.id] || 0) }));
}

export default async function tesourariaMovimentar({ body, user }) {
  const action = body?.action;

  if (action === 'get_resumo') {
    requirePermission(user, 'FINANCEIRO_VIEW');
    const contas = await contasAtivasComTotais(escopoEmpresaDe(user)); // membro só o próprio caixa
    const sumBy = (pred) => r2(contas.filter(pred).reduce((s, c) => s + num(c.saldo_atual), 0));
    return {
      contas,
      resumo: {
        totalGeral: sumBy(() => true),
        totalCaixa: sumBy((c) => c.tipo === 'caixa'),
        totalBancos: sumBy((c) => String(c.tipo || '').startsWith('banco_')),
        totalObras: sumBy((c) => c.tipo === 'conta_obra'),
      },
    };
  }

  if (action === 'get_fluxo_projetado') {
    requirePermission(user, 'FINANCEIRO_VIEW');
    const meses = Math.max(1, Math.min(12, num(body?.meses_projecao) || 6));
    const eid = escopoEmpresaDe(user); // membro só o próprio caixa/fluxo
    const filtro = eid ? { empresa_id: eid } : {};
    const contas = (await store.filter('ContaTesouraria', filtro, undefined, 5000).catch(() => []))
      .filter((c) => !c.status || c.status === 'ativa');
    const saldoAtual = r2(contas.reduce((s, c) => s + num(c.saldo_atual), 0));
    const cf = await store.filter('ContaFinanceira', filtro, undefined, 100000).catch(() => []);
    const ref0 = new Date();
    let acumulado = saldoAtual;
    const projecao = [];
    for (let i = 0; i < meses; i++) {
      const ref = new Date(ref0.getFullYear(), ref0.getMonth() + i, 1);
      const ym = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
      const noMes = (c) => String(c.data_vencimento || '').slice(0, 7) === ym;
      const entradas = r2(cf.filter((c) => c.tipo === 'receber' && c.status !== 'recebido' && c.status !== 'cancelado' && noMes(c)).reduce((s, c) => s + num(c.valor), 0));
      const saidas = r2(cf.filter((c) => c.tipo === 'pagar' && c.status !== 'pago' && c.status !== 'cancelado' && noMes(c)).reduce((s, c) => s + num(c.valor), 0));
      acumulado = r2(acumulado + entradas - saidas);
      projecao.push({ mes: ym, label: `${MESES[ref.getMonth()]}/${String(ref.getFullYear()).slice(2)}`, entradas, saidas, saldo_projetado: acumulado, alerta: acumulado < 0 });
    }
    return { projecao, saldo_atual: saldoAtual };
  }

  if (action === 'criar_conta') {
    requirePermission(user, 'FINANCEIRO_EDIT');
    const d = body || {};
    if (!d.nome) return { error: 'Nome é obrigatório' };
    const saldoIni = num(d.saldo_inicial);
    const rec = await store.create('ContaTesouraria', {
      nome: d.nome, tipo: d.tipo || 'caixa', banco: d.banco || null, agencia: d.agencia || null,
      numero_conta: d.numero_conta || null, obra_id: d.obra_id || null,
      // Caixa é por empresa: membro cria na própria; Matriz pode informar empresa_id (ou herda da obra).
      empresa_id: escopoEmpresaDe(user) || d.empresa_id || null,
      saldo_inicial: saldoIni, saldo_atual: saldoIni, data_saldo_inicial: d.data_saldo_inicial || hoje(),
      permite_saldo_negativo: !!d.permite_saldo_negativo, saldo_inicial_bloqueado: false, status: 'ativa',
    }, user?.email || null);
    return { ok: true, conta: rec };
  }

  if (action === 'bloquear_saldo_inicial') {
    requirePermission(user, 'FINANCEIRO_EDIT');
    if (!body?.conta_id) return { error: 'conta_id é obrigatório' };
    await store.update('ContaTesouraria', body.conta_id, { saldo_inicial_bloqueado: true });
    return { ok: true };
  }

  if (action === 'movimentar') {
    requirePermission(user, 'FINANCEIRO_EDIT');
    const d = body || {};
    const tipo = d.tipo;
    const valor = num(d.valor);
    if (!['entrada', 'saida', 'transferencia'].includes(tipo)) return { error: 'Tipo de movimentação inválido' };
    if (valor <= 0) return { error: 'Valor deve ser maior que zero' };
    if (!d.conta_id) return { error: 'Conta de origem é obrigatória' };
    const conta = (await store.filter('ContaTesouraria', { id: d.conta_id }))[0];
    if (!conta) return { error: 'Conta não encontrada' };

    const baseMov = {
      conta_id: d.conta_id, tipo, valor, descricao: d.descricao || null, categoria: d.categoria || null,
      data_movimentacao: d.data_movimentacao || hoje(), obra_id: d.obra_id || null,
      forma_pagamento: d.forma_pagamento || null, numero_documento: d.numero_documento || null,
    };

    if (tipo === 'entrada') {
      const novo = r2(num(conta.saldo_atual) + valor);
      await store.update('ContaTesouraria', conta.id, { saldo_atual: novo });
      await store.create('MovimentacaoTesouraria', { ...baseMov, saldo_posterior: novo }, user?.email || null);
      return { ok: true, saldo_posterior: novo };
    }

    if (tipo === 'saida') {
      const novo = r2(num(conta.saldo_atual) - valor);
      if (novo < 0 && !conta.permite_saldo_negativo) return { error: 'Saldo insuficiente (a conta não permite saldo negativo)' };
      await store.update('ContaTesouraria', conta.id, { saldo_atual: novo });
      await store.create('MovimentacaoTesouraria', { ...baseMov, saldo_posterior: novo }, user?.email || null);
      return { ok: true, saldo_posterior: novo };
    }

    // transferencia
    if (!d.conta_destino_id) return { error: 'Conta de destino é obrigatória' };
    if (d.conta_destino_id === d.conta_id) return { error: 'Origem e destino devem ser diferentes' };
    const destino = (await store.filter('ContaTesouraria', { id: d.conta_destino_id }))[0];
    if (!destino) return { error: 'Conta de destino não encontrada' };
    const novoOrig = r2(num(conta.saldo_atual) - valor);
    if (novoOrig < 0 && !conta.permite_saldo_negativo) return { error: 'Saldo insuficiente na origem' };
    const novoDest = r2(num(destino.saldo_atual) + valor);
    await store.update('ContaTesouraria', conta.id, { saldo_atual: novoOrig });
    await store.update('ContaTesouraria', destino.id, { saldo_atual: novoDest });
    await store.create('MovimentacaoTesouraria', { ...baseMov, conta_destino_id: d.conta_destino_id, saldo_posterior: novoOrig }, user?.email || null);
    await store.create('MovimentacaoTesouraria', {
      conta_id: d.conta_destino_id, tipo: 'entrada', valor, descricao: `Transferência de ${conta.nome}`,
      categoria: 'transferencia_interna', data_movimentacao: baseMov.data_movimentacao, saldo_posterior: novoDest,
    }, user?.email || null);
    return { ok: true, saldo_posterior: novoOrig };
  }

  return { error: 'Ação inválida' };
}
