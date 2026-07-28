import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Exporta relatórios avançados em CSV (por tipo). Retorna a string CSV.
const cell = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
const csvDe = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\n');

export default async function exportarRelatorioAvancado({ body, user }) {
  requirePermission(user, 'RELATORIOS_VIEW');
  const tipo = String(body?.tipo || 'obras').toLowerCase();

  if (tipo.includes('material') || tipo.includes('estoque') || tipo.includes('insumo')) {
    // Base canônica de insumos (catálogo compartilhado do grupo — sem escopo por empresa).
    const insumos = await store.filter('Insumo', {}, '-updated_date', 10000).catch(() => []);
    return csvDe(['Código', 'Descrição', 'Grupo', 'Unidade', 'Preço Unit.', 'Base', 'Ativo'],
      insumos.map((i) => [i.codigo, i.descricao, i.grupo, i.unidade, i.preco_unitario, i.base, i.ativo !== false ? 'Sim' : 'Não']));
  }
  if (tipo.includes('compra') || tipo.includes('ordens')) {
    let ocs = await store.filter('OrdemCompra', {}, '-created_date', 10000).catch(() => []);
    if (!isGlobal(user)) { const eid = empresaIdDe(user); ocs = ocs.filter((o) => o.empresa_id === eid); }
    return csvDe(['Número', 'Fornecedor', 'Status', 'Valor', 'Data'],
      ocs.map((o) => [o.numero, o.fornecedor_nome || o.fornecedor, o.status, o.valor_total || o.valor, o.data_emissao || o.created_date]));
  }
  if (tipo.includes('requisic')) {
    let reqs = await store.filter('RequisicaoCompra', {}, '-created_date', 10000).catch(() => []);
    if (!isGlobal(user)) { const eid = empresaIdDe(user); reqs = reqs.filter((r) => r.empresa_id === eid); }
    return csvDe(['Número', 'Obra', 'Status', 'Solicitante', 'Data'],
      reqs.map((r) => [r.numero, r.obra_nome, r.status, r.solicitante_nome, r.created_date]));
  }
  // default: obras
  let obras = await store.filter('Obra', {}, '-updated_date', 10000).catch(() => []);
  if (!isGlobal(user)) { const eid = empresaIdDe(user); obras = obras.filter((o) => o.empresa_id === eid); }
  return csvDe(['Obra', 'Status', 'Valor Contrato', 'Valor Realizado', '% Concluído'],
    obras.map((o) => [o.nome, o.status, o.valor_contrato, o.valor_realizado, o.percentual_concluido]));
}
