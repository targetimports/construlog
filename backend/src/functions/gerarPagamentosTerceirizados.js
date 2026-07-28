import { store } from '../entityStore.js';
import { can } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// PAGAMENTO MENSAL DO TERCEIRIZADO — o único regime que não tinha trilho.
//
// Por que não é folha: terceirizado não é CLT (sem FGTS, 13º ou hora extra legal).
// A folha calcula tudo isso — botá-lo lá misturaria vínculos diferentes no mesmo
// documento e produziria encargos que não existem. O custo dele é conta a pagar.
//
// Por que RATEADO POR OBRA (uma conta por obra, não uma conta só):
// o mesmo princípio que rege o resto do sistema — **o custo segue as horas**. A
// conta nasce com obra_id, então a DRE da obra e o consolidado por empresa já a
// enxergam sem helper nenhum. Uma conta única com obra_id null sumiria da DRE das
// obras (foi exatamente o buraco que a folha dos mensalistas CLT tinha).
//
// Rateio: horas apontadas na obra ÷ horas do mês × valor mensal. Sem ponto no mês,
// cai na obra fixa do cadastro; sem obra fixa, sai uma conta sem obra (fica visível
// no Contas a Pagar para alguém corrigir, em vez de sumir).
//
// Idempotente por (competência, terceirizado): não paga o mesmo mês duas vezes.
const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;
const STATUS_FORA = new Set(['REJEITADO', 'CANCELADO', 'CANCELADA']);

export default async function gerarPagamentosTerceirizados({ body, user }) {
  // Gera despesa (Financeiro) de gente (RH) — as duas pontas fecham o mês.
  if (!can(user, 'FINANCEIRO_EDIT') && !can(user, 'RH_FOLHA')) {
    throw Object.assign(new Error('Sem permissão para gerar pagamentos de terceirizados.'), { status: 403 });
  }
  const { competencia, empresa_id } = body || {};
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    throw Object.assign(new Error('Competência inválida (use YYYY-MM)'), { status: 400 });
  }

  // Escopo: membro só gera da própria empresa; global pode escolher.
  const escopo = isGlobal(user) ? (empresa_id || null) : empresaIdDe(user);

  const todos = (await store.filter('ProfissionalTerceirizado', {}, undefined, 1000)) || [];
  const mensais = todos
    .filter((p) => (p.status || 'ativo') === 'ativo')
    .filter((p) => String(p.tipo_pagamento) === 'MENSAL')
    .filter((p) => num(p.valor_mensal) > 0)
    .filter((p) => !escopo || p.empresa_id === escopo);

  if (mensais.length === 0) {
    throw Object.assign(new Error('Nenhum terceirizado mensal ativo com valor definido.'), { status: 400 });
  }

  const aps = ((await store.filter('ApontamentoMaoObra', {}, undefined, 100000)) || [])
    .filter((a) => String(a.data || '').startsWith(competencia))
    .filter((a) => !STATUS_FORA.has(String(a.status || '').toUpperCase()));

  const obras = (await store.filter('Obra', {}, undefined, 5000)) || [];
  const obraById = Object.fromEntries(obras.map((o) => [o.id, o]));
  const hoje = new Date().toISOString().split('T')[0];

  const criados = [];
  const pulados = [];

  for (const p of mensais) {
    // Idempotência: já existe conta deste mês para ele?
    const jaTem = ((await store.filter('ContaFinanceira', {
      referencia_tipo: 'terceirizado_mensal',
      referencia_id: `${competencia}:${p.id}`,
    })) || []).filter((c) => c.status !== 'cancelado');
    if (jaTem.length) { pulados.push({ terceirizado: p.nome, motivo: 'ja_pago_no_mes' }); continue; }

    // Horas do mês por obra (o ponto diz ONDE ele trabalhou).
    const meus = aps.filter((a) => (a.profissional_id || a.colaborador_id) === p.id);
    const horasPorObra = {};
    let horasTotal = 0;
    let horasExtra = 0;
    for (const a of meus) {
      const h = num(a.horas_normais);
      horasExtra += num(a.horas_extra);
      if (!a.obra_id || h <= 0) continue;
      horasPorObra[a.obra_id] = (horasPorObra[a.obra_id] || 0) + h;
      horasTotal += h;
    }

    // HORA EXTRA: o mensal receberia só o fixo e trabalharia de graça no excedente.
    // Aqui não há adicional legal de 50% (não é CLT) — paga-se o valor/hora
    // combinado no cadastro, que é o que foi acordado com o terceiro.
    const valorHE = r2(horasExtra * num(p.valor_hora));
    const valor = r2(num(p.valor_mensal) + valorHE);
    // Sem ponto no mês → obra fixa do cadastro (ou nenhuma).
    const distrib = horasTotal > 0
      ? Object.entries(horasPorObra).map(([obra_id, h]) => ({ obra_id, valor: r2((h / horasTotal) * valor), horas: r2(h) }))
      : [{ obra_id: p.obra_id || null, valor: r2(valor), horas: 0 }];

    // Sobra de centavo do rateio vai na maior fatia — a soma tem que fechar com o
    // valor combinado, senão o terceirizado recebe a menos.
    const soma = r2(distrib.reduce((s, d) => s + d.valor, 0));
    if (distrib.length && soma !== valor) {
      const maior = distrib.reduce((a, b) => (b.valor > a.valor ? b : a));
      maior.valor = r2(maior.valor + (valor - soma));
    }

    const contas = [];
    for (const d of distrib) {
      const obra = d.obra_id ? obraById[d.obra_id] : null;
      const conta = await store.create('ContaFinanceira', {
        tipo: 'pagar',
        obra_id: d.obra_id || null,
        empresa_id: obra?.empresa_id || p.empresa_id || null,
        descricao: `Terceirizado mensal — ${p.nome} (${competencia})${obra ? ` — ${obra.nome}` : ''}`,
        categoria: 'mao_de_obra',
        valor: d.valor,
        status: 'pendente',
        data_emissao: hoje,
        data_vencimento: hoje,
        fornecedor_cliente: p.empresa_contratante || p.nome,
        terceirizado_id: p.id,
        referencia_tipo: 'terceirizado_mensal',
        referencia_id: `${competencia}:${p.id}`,
        observacao: [
          d.horas > 0
            ? `Rateio por horas apontadas: ${d.horas}h de ${r2(horasTotal)}h no mês`
            : 'Sem ponto no mês — lançado na obra do cadastro',
          valorHE > 0 ? `Inclui ${r2(horasExtra)}h extra (R$ ${valorHE.toFixed(2)} no total do mês)` : null,
        ].filter(Boolean).join(' · '),
      }, user?.email || null);
      contas.push({ conta_id: conta.id, obra: obra?.nome || null, valor: d.valor, horas: d.horas });
    }

    criados.push({
      terceirizado: p.nome,
      valor_mensal: valor,
      fixo: r2(num(p.valor_mensal)),
      horas_extra: r2(horasExtra),
      valor_horas_extra: valorHE,
      horas_mes: r2(horasTotal),
      contas,
    });
  }

  const total = r2(criados.reduce((s, c) => s + c.valor_mensal, 0));
  return { success: true, competencia, gerados: criados.length, pulados, total, detalhes: criados };
}
