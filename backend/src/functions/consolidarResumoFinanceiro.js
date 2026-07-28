import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Resumo financeiro consolidado do mês (despesas por categoria) — alimenta o Dashboard
// Financeiro (Resumo.jsx). Escopado por empresa (membro vê só o dele). Conserta o 404.
const num = (x) => Number(x) || 0;
const r2 = (x) => Math.round(num(x) * 100) / 100;
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const bucketResumo = (cat) => {
  const s = norm(cat);
  if (/material|insumo|compra/.test(s)) return 'total_material';
  if (/mao|m_o|folha|salario|pessoal|diaria/.test(s)) return 'total_mao_de_obra';
  if (/aliment|refei|comida/.test(s)) return 'total_alimentacao';
  if (/aluguel|locac|equip|maquina/.test(s)) return 'total_aluguel_equipamento';
  if (/frete|transporte|logistica/.test(s)) return 'total_frete';
  if (/estadia|hosped|hotel/.test(s)) return 'total_estadia';
  if (/imposto|tribut|taxa|inss|iss/.test(s)) return 'total_imposto';
  if (/investiment/.test(s)) return 'total_investimento';
  if (/retirada|pro.?labore|distribuic/.test(s)) return 'total_retirada';
  if (/empreita/.test(s)) return 'total_empreita';
  return 'total_generico';
};

export default async function consolidarResumoFinanceiro({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');
  const periodo = String(body?.periodo || new Date().toISOString().slice(0, 7)).slice(0, 7); // YYYY-MM
  const dentro = (d) => String(d || '').slice(0, 7) === periodo;

  let contas = await store.filter('ContaFinanceira', { tipo: 'pagar' }, undefined, 100000).catch(() => []);
  if (!isGlobal(user)) { const eid = empresaIdDe(user); contas = contas.filter((c) => c.empresa_id === eid); }

  const resumo = {
    data_atualizacao: new Date().toISOString(), periodo,
    total_geral: 0, total_material: 0, total_mao_de_obra: 0, total_alimentacao: 0,
    total_aluguel_equipamento: 0, total_frete: 0, total_estadia: 0, total_imposto: 0,
    total_investimento: 0, total_retirada: 0, total_empreita: 0, total_generico: 0,
  };
  for (const c of contas) {
    if (c.status === 'cancelado') continue;
    const d = c.data_pagamento || c.data_vencimento || c.updated_date;
    if (!dentro(d)) continue;
    const v = num(c.valor);
    resumo.total_geral += v;
    resumo[bucketResumo(c.categoria)] += v;
  }
  for (const k of Object.keys(resumo)) { if (k.startsWith('total_')) resumo[k] = r2(resumo[k]); }

  return { success: true, resumo };
}
