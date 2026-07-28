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

// Fluxo de caixa REALIZADO por mês: entradas (receber liquidado) x saídas (pagar liquidado).
export default async function getFluxoCaixaObra({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const { obra_id, de, ate, granularidade = 'mes' } = body || {};
  if (!obra_id) return { error: 'Field obra_id is required' };

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) return { error: 'Obra not found' };
  if (!(await podeAcessarObra(user, obra_id))) return { error: 'Sem acesso a esta obra (outra empresa).' };

  const ano = new Date().getFullYear();
  const ini = new Date(de || `${ano}-01-01`);
  const fim = new Date(ate || `${ano}-12-31`);

  const periodos = new Map();
  const cursor = new Date(ini.getFullYear(), ini.getMonth(), 1);
  let guard = 0;
  while (cursor <= fim && guard++ < 120) {
    const p = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    periodos.set(p, { periodo: p, de: `${p}-01`, ate: fimMes(p), entradas: 0, saidas: 0, saldo_mes: 0, saldo_acumulado: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const contas = await store.filter('ContaFinanceira', { obra_id }, undefined, 100000).catch(() => []);
  for (const c of contas) {
    if (c.tipo === 'receber' && num(c.valor_recebido) > 0) {
      const p = mesDe(c.data_recebimento || c.data_pagamento || c.updated_date);
      if (p && periodos.has(p)) periodos.get(p).entradas += num(c.valor_recebido);
    } else if (c.tipo === 'pagar' && ['pago', 'parcial'].includes(c.status)) {
      const p = mesDe(c.data_pagamento || c.updated_date);
      if (p && periodos.has(p)) periodos.get(p).saidas += num(c.valor_pago ?? c.valor);
    }
  }

  const alertas = [];
  let acum = 0;
  const serie = [...periodos.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  for (const p of serie) {
    p.entradas = r2(p.entradas);
    p.saidas = r2(p.saidas);
    p.saldo_mes = r2(p.entradas - p.saidas);
    acum = r2(acum + p.saldo_mes);
    p.saldo_acumulado = acum;
    if (p.saldo_acumulado < 0) {
      alertas.push({ tipo: 'saldo_negativo', periodo: p.periodo, severidade: 'alto', valor: p.saldo_acumulado });
    }
  }

  return { ok: true, obra_id, granularidade, serie, alertas };
}
