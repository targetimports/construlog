import { store } from '../entityStore.js';

// Simulador de Viabilidade da Obra (plano §23): projeta o fluxo de caixa
// mês a mês ANTES de ativar a obra e responde:
//   - pode_ativar (a projeção nunca fica negativa)
//   - mes_critico (mês de menor saldo acumulado)
//   - valor_necessario_cobrir (quanto de caixa/aporte cobriria o pior mês)
//   - margem (recebimentos − custos)
//
// Entradas: RecebimentoPrevisto (por data_prevista).
// Saídas (custos previstos por mês), em ordem de preferência:
//   1) CronogramaItemPeriodo (distribuição físico-financeira do OrçaFácil)
//   2) PlannedCostItem (com data)
//   3) Orçamento total distribuído uniformemente entre data_inicio e data_prevista_fim

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(num(n) * 100) / 100;

function mesKey(d) {
  if (!d) return null;
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export default async function simularViabilidadeObra({ body }) {
  const { obra_id, caixa_inicial = 0 } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });

  const obra = (await store.filter('Obra', { id: obra_id }))[0] || {};

  // ── Entradas: recebimentos previstos por mês ───────────────────────────
  const recs = (await store.filter('RecebimentoPrevisto', { obra_id }).catch(() => []))
    .filter((r) => r.status !== 'CANCELADO');
  const entradasPorMes = {};
  let totalRecebimentos = 0;
  for (const r of recs) {
    const m = mesKey(r.data_prevista) || 'sem-data';
    const v = num(r.valor_previsto);
    entradasPorMes[m] = (entradasPorMes[m] || 0) + v;
    totalRecebimentos += v;
  }

  // ── Saídas: custos previstos por mês ───────────────────────────────────
  const saidasPorMes = {};
  let totalCustos = 0;
  let custoFonte = 'cronograma';

  const cip = await store.filter('CronogramaItemPeriodo', { obra_id }).catch(() => []);
  if (cip.length) {
    for (const p of cip) {
      const m = mesKey(p.mes) || String(p.mes || 'sem-data');
      const v = num(p.valor);
      saidasPorMes[m] = (saidasPorMes[m] || 0) + v;
      totalCustos += v;
    }
  }
  if (totalCustos <= 0) {
    const planned = await store.filter('PlannedCostItem', { obra_id }).catch(() => []);
    if (planned.length) {
      custoFonte = 'planejado';
      for (const p of planned) {
        const m = mesKey(p.data ?? p.data_prevista ?? p.mes) || 'sem-data';
        const v = num(p.valor_estimado ?? p.custo_estimado ?? p.valor_previsto ?? p.valor);
        saidasPorMes[m] = (saidasPorMes[m] || 0) + v;
        totalCustos += v;
      }
    }
  }
  if (totalCustos <= 0) {
    custoFonte = 'orcamento_uniforme';
    const orcado = num(obra.valor_orcado) || num(obra.total_final_orcamento) || num(obra.total_orcamento);
    totalCustos = orcado;
    const ini = obra.data_inicio ? new Date(obra.data_inicio) : null;
    const fimRaw = obra.data_prevista_fim || obra.data_fim;
    const fim = fimRaw ? new Date(fimRaw) : null;
    if (orcado > 0 && ini && fim && !isNaN(ini.getTime()) && !isNaN(fim.getTime()) && fim >= ini) {
      const meses = [];
      const cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
      const end = new Date(fim.getFullYear(), fim.getMonth(), 1);
      while (cur <= end) {
        meses.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
        cur.setMonth(cur.getMonth() + 1);
      }
      const por = orcado / meses.length;
      for (const m of meses) saidasPorMes[m] = (saidasPorMes[m] || 0) + por;
    } else if (orcado > 0) {
      saidasPorMes['sem-data'] = (saidasPorMes['sem-data'] || 0) + orcado;
    }
  }

  // ── Projeção mês a mês ─────────────────────────────────────────────────
  const comData = [...new Set([...Object.keys(entradasPorMes), ...Object.keys(saidasPorMes)])]
    .filter((m) => m !== 'sem-data').sort();
  const todosMeses = [...comData];
  if (entradasPorMes['sem-data'] || saidasPorMes['sem-data']) todosMeses.push('sem-data');

  let acumulado = num(caixa_inicial);
  let menorAcum = acumulado;
  let mesCritico = null;
  const meses = todosMeses.map((m) => {
    const ent = r2(entradasPorMes[m] || 0);
    const sai = r2(saidasPorMes[m] || 0);
    const saldoMes = r2(ent - sai);
    acumulado = r2(acumulado + saldoMes);
    if (acumulado < menorAcum) { menorAcum = acumulado; mesCritico = m; }
    return { mes: m, entradas: ent, saidas: sai, saldo_mes: saldoMes, saldo_acumulado: acumulado };
  });

  const valorNecessarioCobrir = menorAcum < 0 ? r2(-menorAcum) : 0;
  const margem = totalRecebimentos > 0 ? r2(((totalRecebimentos - totalCustos) / totalRecebimentos) * 100) : 0;
  const temRecebimentos = totalRecebimentos > 0;
  const podeAtivar = temRecebimentos && menorAcum >= 0;

  const motivo = !temRecebimentos
    ? 'Sem recebimentos previstos cadastrados — não há como projetar as entradas.'
    : podeAtivar
      ? 'O fluxo de caixa projetado não fica negativo em nenhum mês.'
      : `A projeção fica negativa (pior saldo: ${menorAcum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`;

  return {
    obra_id,
    pode_ativar: podeAtivar,
    motivo,
    mes_critico: mesCritico ? { mes: mesCritico, saldo_acumulado: r2(menorAcum) } : null,
    valor_necessario_cobrir: valorNecessarioCobrir,
    margem_percentual: margem,
    total_recebimentos: r2(totalRecebimentos),
    total_custos: r2(totalCustos),
    caixa_inicial: num(caixa_inicial),
    custo_fonte: custoFonte,
    meses,
  };
}
