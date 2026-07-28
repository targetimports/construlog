import { store } from '../entityStore.js';

// Regra-Mãe de ativação da obra (plano §2/§4): só permite ativar (status
// "em_andamento") uma obra que tenha:
//   1) Orçamento previsto (orçamento sintético ou valor contratado)
//   2) Custo previsto
//   3) Plano de recebimento (recebimentos previstos)
//   4) Fluxo de caixa positivo (entradas previstas cobrem as saídas previstas)
//
// Modo de validação (ConfiguracaoSistema.chave='modo_validacao_inicio_obra'):
//   'rigoroso' (default) → bloqueia a ativação se faltar requisito
//   'flexivel'           → apenas alerta, permite continuar
//
// Retorno (compatível com ValidacaoInicioObraDialog):
//   { success, pode_ativar, bloqueado, modoRigoroso, checks[], alertas[], fluxo }

const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function validarInicioObra({ body }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });

  const obra = (await store.filter('Obra', { id: obra_id }))[0] || {};

  // Modo de validação — default rigoroso (a Regra-Mãe é uma trava).
  let modoRigoroso = true;
  try {
    const cfgs = await store.filter('ConfiguracaoSistema', { chave: 'modo_validacao_inicio_obra' });
    if (cfgs?.[0]) modoRigoroso = cfgs[0].valor !== 'flexivel';
  } catch (_) { /* sem config → rigoroso */ }

  // ── 1) ORÇAMENTO previsto ──────────────────────────────────────────────
  const orcamentos = await store.filter('Orcamento', { obra_id }).catch(() => []);
  const orcamentoTotalEntidade = orcamentos.reduce((s, o) => Math.max(s, num(o.valor_total)), 0);
  let itensCount = 0;
  if (orcamentos[0]) {
    itensCount = (await store.filter('ItemOrcamento', { orcamento_id: orcamentos[0].id }, '-created_date', 1).catch(() => [])).length;
  }
  if (!itensCount) {
    itensCount = (await store.filter('ItemOrcamento', { obra_id }, '-created_date', 1).catch(() => [])).length;
  }
  const valorContrato = num(obra.valor_contrato);
  const valorOrcado = num(obra.valor_orcado) || num(obra.total_final_orcamento) || num(obra.total_orcamento) || orcamentoTotalEntidade;
  const orcamentoBase = valorContrato || valorOrcado || orcamentoTotalEntidade;
  const temOrcamento = orcamentoTotalEntidade > 0 || valorContrato > 0 || valorOrcado > 0 || itensCount > 0;

  // ── 2) CUSTO PREVISTO ──────────────────────────────────────────────────
  const planned = await store.filter('PlannedCostItem', { obra_id }).catch(() => []);
  let custoPrevistoTotal = planned.reduce(
    (s, p) => s + num(p.valor_estimado ?? p.custo_estimado ?? p.valor_previsto ?? p.valor), 0
  );
  let custoFonte = 'planejado';
  if (custoPrevistoTotal <= 0) {
    // Fallback: o orçamento sintético representa o custo previsto da obra.
    custoPrevistoTotal = orcamentoBase;
    custoFonte = 'orcamento';
  }
  const temCustoPrevisto = custoPrevistoTotal > 0;

  // ── 3) RECEBIMENTO PREVISTO ────────────────────────────────────────────
  const recebimentos = await store.filter('RecebimentoPrevisto', { obra_id }).catch(() => []);
  const recebimentoTotal = recebimentos.reduce((s, r) => s + num(r.valor_previsto ?? r.valor), 0);
  const temRecebimentoPrevisto = recebimentos.length > 0 && recebimentoTotal > 0;

  // ── 4) FLUXO DE CAIXA (projeção simplificada) ──────────────────────────
  // As entradas previstas (recebimentos) devem cobrir as saídas previstas (custos).
  const saldoProjetado = recebimentoTotal - custoPrevistoTotal;
  const fluxoPositivo = temRecebimentoPrevisto && saldoProjetado >= 0;

  const checks = [
    {
      chave: 'orcamento',
      label: 'Orçamento previsto',
      ok: temOrcamento,
      detalhe: temOrcamento ? `Orçado: ${fmt(orcamentoBase)}` : 'Sem orçamento sintético ou valor contratado.',
    },
    {
      chave: 'custo_previsto',
      label: 'Custo previsto',
      ok: temCustoPrevisto,
      detalhe: temCustoPrevisto
        ? `${fmt(custoPrevistoTotal)}${custoFonte === 'orcamento' ? ' (estimado pelo orçamento)' : ''}`
        : 'Nenhum custo previsto cadastrado.',
    },
    {
      chave: 'recebimento_previsto',
      label: 'Recebimento previsto',
      ok: temRecebimentoPrevisto,
      detalhe: temRecebimentoPrevisto
        ? `${recebimentos.length} previsto(s) · ${fmt(recebimentoTotal)}`
        : 'Nenhum plano de recebimento cadastrado.',
    },
    {
      chave: 'fluxo_caixa',
      label: 'Fluxo de caixa positivo',
      ok: fluxoPositivo,
      detalhe: !temRecebimentoPrevisto
        ? 'Depende dos recebimentos previstos.'
        : fluxoPositivo
          ? `Saldo projetado: ${fmt(saldoProjetado)}`
          : `Saldo projetado NEGATIVO: ${fmt(saldoProjetado)} (recebimentos não cobrem os custos).`,
    },
  ];

  const pendentes = checks.filter((c) => !c.ok);
  const podeAtivar = pendentes.length === 0;
  const bloqueado = modoRigoroso && !podeAtivar;
  const alertas = pendentes.map((c) => `${c.label}: ${c.detalhe}`);

  return {
    success: true,
    pode_ativar: podeAtivar,
    bloqueado,
    modoRigoroso,
    checks,
    alertas,
    fluxo: {
      recebimentos_previstos: recebimentoTotal,
      custos_previstos: custoPrevistoTotal,
      saldo_projetado: saldoProjetado,
    },
  };
}
