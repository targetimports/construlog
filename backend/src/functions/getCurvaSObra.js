import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { podeAcessarObra } from '../escopoObra.js';

const num = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d.,-]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mesDe = (d) => {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};
const fimMes = (p) => {
  const [a, m] = p.split('-');
  const last = new Date(Number(a), Number(m), 0).getDate();
  return `${a}-${m}-${String(last).padStart(2, '0')}`;
};
// Categoria (texto livre) -> grupo (sem depender de CategoriaFinanceira).
const grupoDe = (cat) => {
  const c = String(cat || '').toLowerCase();
  if (c.includes('material')) return 'material';
  if (c.includes('mao') || c.includes('mão')) return 'mao_obra';
  if (c.includes('servic') || c.includes('serviç')) return 'servico';
  if (c.includes('imposto')) return 'imposto';
  if (c.includes('admin') || c.includes('adm') || c.includes('aluguel') || c.includes('rateio')) return 'adm';
  return 'outros';
};

// Curva S: planejado (orçamento distribuído) x realizado (receita/custos) por mês.
export default async function getCurvaSObra({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const { obra_id, de, ate, granularidade = 'mes' } = body || {};
  if (!obra_id) return { error: 'Field obra_id is required' };

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) return { error: 'Obra not found' };
  if (!(await podeAcessarObra(user, obra_id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const warnings = [];
  const ano = new Date().getFullYear();
  const ini = new Date(de || `${ano}-01-01`);
  const fim = new Date(ate || `${ano}-12-31`);

  const periodos = new Map();
  const cursor = new Date(ini.getFullYear(), ini.getMonth(), 1);
  let guard = 0;
  while (cursor <= fim && guard++ < 120) {
    const p = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    periodos.set(p, {
      periodo: p, de: `${p}-01`, ate: fimMes(p),
      planejado_receita: 0, planejado_custo: 0,
      real_receita: 0, real_custo_total: 0,
      real_materiais: 0, real_servicos: 0, real_mao_obra: 0, real_impostos: 0, real_adm: 0,
      saldo_mes: 0, saldo_acumulado: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // 1) Planejado: distribui o orçamento total da obra linearmente entre os meses.
  const valorPlanejado = num(obra.total_orcamento) || num(obra.valor_contrato) || num(obra.valor_orcado);
  if (valorPlanejado > 0 && periodos.size > 0) {
    const porMes = valorPlanejado / periodos.size;
    periodos.forEach((p) => { p.planejado_receita = porMes; });
  } else {
    warnings.push('Obra sem orçamento total para distribuir a curva planejada.');
  }

  // 2) Real: ContaFinanceira (receita liquidada e custos pagos por grupo de categoria)
  const contas = await store.filter('ContaFinanceira', { obra_id }, undefined, 100000).catch(() => []);
  for (const c of contas) {
    if (c.tipo === 'receber' && num(c.valor_recebido) > 0) {
      const p = mesDe(c.data_recebimento || c.data_pagamento || c.updated_date);
      if (p && periodos.has(p)) periodos.get(p).real_receita += num(c.valor_recebido);
    } else if (c.tipo === 'pagar' && ['pago', 'parcial'].includes(c.status)) {
      const p = mesDe(c.data_pagamento || c.updated_date);
      if (!p || !periodos.has(p)) continue;
      const g = grupoDe(c.categoria);
      const v = num(c.valor_pago ?? c.valor);
      const reg = periodos.get(p);
      reg.real_custo_total += v;
      if (g === 'material') reg.real_materiais += v;
      else if (g === 'servico') reg.real_servicos += v;
      else if (g === 'mao_obra') reg.real_mao_obra += v;
      else if (g === 'imposto') reg.real_impostos += v;
      else if (g === 'adm') reg.real_adm += v;
    }
  }

  // 3) Saldos
  let acum = 0;
  const serie = [...periodos.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  for (const p of serie) {
    for (const k of ['planejado_receita', 'planejado_custo', 'real_receita', 'real_custo_total', 'real_materiais', 'real_servicos', 'real_mao_obra', 'real_impostos', 'real_adm']) {
      p[k] = r2(p[k]);
    }
    p.saldo_mes = r2(p.real_receita - p.real_custo_total);
    acum = r2(acum + p.saldo_mes);
    p.saldo_acumulado = acum;
  }

  const totals = {};
  for (const k of ['planejado_receita', 'planejado_custo', 'real_receita', 'real_custo_total', 'real_materiais', 'real_servicos', 'real_mao_obra', 'real_impostos', 'real_adm']) {
    totals[k] = r2(serie.reduce((s, p) => s + p[k], 0));
  }

  return { ok: true, obra_id, granularidade, serie, totals, warnings };
}
