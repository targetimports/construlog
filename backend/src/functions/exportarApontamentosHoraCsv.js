import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { isGlobal, empresaIdDe } from '../middleware.js';

// Porte de exportarApontamentosHoraCsv: gera CSV (base64) dos apontamentos filtrados.
export default async function exportarApontamentosHoraCsv({ body, user }) {
  requirePermission(user, 'RELATORIOS_VIEW');
  const { obra_id, colaborador_id, equipe_id, status, de, ate, origem } = body || {};

  const filtro = {};
  if (obra_id) filtro.obra_id = obra_id;
  if (colaborador_id) filtro.colaborador_id = colaborador_id;
  if (equipe_id) filtro.equipe_id = equipe_id;
  if (status) filtro.status = status;
  if (origem) filtro.origem = origem;

  let resultado = (await store.filter('ApontamentoHora', filtro, '-data', 10000)) || [];
  if (de || ate) {
    resultado = resultado.filter((ap) => {
      const d = new Date(ap.data);
      if (de && d < new Date(de)) return false;
      if (ate && d > new Date(ate)) return false;
      return true;
    });
  }

  // Enriquece com nomes (colaborador/obra) para o CSV ficar legível.
  const colabs = await store.filter('Colaborador', {}, '-created_date', 5000).catch(() => []);
  let obras = await store.filter('Obra', {}, '-created_date', 5000).catch(() => []);
  if (!isGlobal(user)) {
    // ApontamentoHora não carrega empresa_id (é escopado por obra). Restringe as obras à
    // empresa do usuário e filtra os apontamentos EXPORTADOS às obras permitidas (fail-closed).
    const eid = empresaIdDe(user);
    obras = (obras || []).filter((o) => o.empresa_id === eid);
    const obrasPermitidas = new Set(obras.map((o) => o.id));
    resultado = resultado.filter((ap) => obrasPermitidas.has(ap.obra_id));
  }
  const colMap = Object.fromEntries((colabs || []).map((c) => [c.id, c.nome]));
  const obraMap = Object.fromEntries((obras || []).map((o) => [o.id, o.nome]));

  const headers = ['Data', 'Colaborador', 'Obra', 'Horas Normais', 'Horas Extras', 'Custo Hora', 'Custo Total', 'Status', 'Origem', 'Observação'];
  const rows = resultado.map((ap) => [
    ap.data,
    colMap[ap.colaborador_id] || ap.colaborador_id,
    obraMap[ap.obra_id] || ap.obra_id,
    ap.horas_normais, ap.horas_extras, ap.custo_hora, ap.custo_total,
    ap.status, ap.origem, ap.observacao || '',
  ]);

  // Padrão CSV do sistema: BOM UTF-8 + separador ';' + escaping (pt-BR/Excel).
  const cell = (x) => {
    const s = String(x ?? '');
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [headers, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');

  const csv_base64 = Buffer.from(csv, 'utf-8').toString('base64');
  const filename = `apontamentos_horas_${new Date().toISOString().split('T')[0]}.csv`;
  return { ok: true, csv_base64, filename, linhas: resultado.length };
}
