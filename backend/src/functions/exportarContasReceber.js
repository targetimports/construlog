import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Exporta contas (a pagar OU a receber, conforme filtros.tipo) em CSV.
// Usada tanto por Contas a Pagar quanto por Contas a Receber.
// Retorna a string CSV (com BOM, para acentos no Excel).

const num = (v) => Number(v) || 0;
const esc = (v) => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default async function exportarContasReceber({ body, user }) {
  requirePermission(user, 'FINANCEIRO_VIEW');

  const f = body?.filtros || {};
  const tipo = f.tipo || 'receber';

  let rows = await store.filter('ContaFinanceira', { tipo }, '-data_vencimento', 100000).catch(() => []);
  if (!isGlobal(user)) {
    const eid = empresaIdDe(user);
    rows = rows.filter((c) => c.empresa_id === eid);
  }
  if (f.obra_id) rows = rows.filter((c) => c.obra_id === f.obra_id);
  if (f.status) rows = rows.filter((c) => c.status === f.status);
  if (f.categoria) rows = rows.filter((c) => c.categoria === f.categoria);
  if (f.data_vencimento_de) rows = rows.filter((c) => String(c.data_vencimento || '') >= f.data_vencimento_de);
  if (f.data_vencimento_ate) rows = rows.filter((c) => String(c.data_vencimento || '') <= f.data_vencimento_ate);
  if (f.valor_min) rows = rows.filter((c) => num(c.valor) >= num(f.valor_min));
  if (f.valor_max) rows = rows.filter((c) => num(c.valor) <= num(f.valor_max));
  if (f.busca) {
    const b = String(f.busca).toLowerCase();
    rows = rows.filter((c) =>
      (c.descricao || '').toLowerCase().includes(b) ||
      (c.fornecedor_cliente || '').toLowerCase().includes(b));
  }
  rows.sort((a, b) => String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')));

  const header = ['Vencimento', 'Descrição', 'Fornecedor/Cliente', 'Categoria', 'Valor', 'Status', 'Liquidação', 'Obra'];
  const linhas = rows.map((c) => [
    c.data_vencimento || '',
    c.descricao || '',
    c.fornecedor_cliente || '',
    c.categoria || '',
    num(c.valor).toFixed(2),
    c.status || '',
    c.data_pagamento || c.data_recebimento || '',
    c.obra_nome || c.obra_id || '',
  ].map(esc).join(';'));

  return '﻿' + [header.join(';'), ...linhas].join('\n');
}
