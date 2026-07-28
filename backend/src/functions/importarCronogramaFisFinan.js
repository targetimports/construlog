import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

function parseValorBR(valor) {
  if (valor == null || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  const str = String(valor).replace(/[^\d,.%-]/g, '');
  if (!str) return 0;
  const hasCommaDecimal = str.includes(',') && str.lastIndexOf(',') > str.lastIndexOf('.');
  const normalized = hasCommaDecimal ? str.replace(/\./g, '').replace(',', '.') : str.replace(',', '');
  const n = parseFloat(normalized.replace('%', ''));
  return isNaN(n) ? 0 : n;
}

function lerBuffer(fileUrl) {
  const m = String(fileUrl || '').match(/\/files\/([^/?#]+)/);
  if (m) {
    const file = path.basename(decodeURIComponent(m[1]));
    const full = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(full)) throw new Error('Arquivo não encontrado no servidor.');
    return fs.readFileSync(full);
  }
  throw new Error('file_url inválido.');
}

export default async function importarCronogramaFisFinan({ body }) {
  const { file_url, arquivo_nome } = body || {};
  if (!file_url) return { error: 'file_url obrigatório' };

  let buffer;
  try { buffer = lerBuffer(file_url); } catch (e) { return { error: e.message }; }
  if (buffer.byteLength > 10 * 1024 * 1024) {
    return { error: `Arquivo muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Limite: 10 MB.` };
  }

  let workbook;
  try { workbook = XLSX.read(buffer, { type: 'buffer' }); }
  catch (_e) { return { error: 'Arquivo Excel inválido ou corrompido. Confirme que é .xlsx/.xls.' }; }

  const candidatos = ['Cronograma Físico-Financeiro', 'Cronograma Fisico-Financeiro', 'Cronograma', 'CFF', 'Fisico-Financeiro', 'Físico-Financeiro', 'S-Cronograma'];
  let sheetName = workbook.SheetNames[0];
  for (const nome of candidatos) { if (workbook.SheetNames.includes(nome)) { sheetName = nome; break; } }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { error: 'Nenhuma planilha encontrada no arquivo.' };

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const merged = {};
  for (const m of (sheet['!merges'] || [])) {
    const master = sheet[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
    const val = master ? (master.w ?? master.v ?? '') : '';
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        merged[`${r}_${c}`] = val;
      }
    }
  }
  const rows = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const key = `${R}_${C}`;
      if (merged[key] !== undefined) row.push(merged[key]);
      else { const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })]; row.push(cell ? (cell.v ?? '') : ''); }
    }
    rows.push(row);
  }

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const norm = rows[i].map((c) => String(c ?? '').toLowerCase().replace(/\s+/g, ' ').trim());
    if (norm.some((c) => c === 'item' || c === 'item.') && norm.some((c) => c.includes('descri'))) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return { error: 'Cabeçalho não encontrado (Item/Descrição). Verifique o layout do CFF.' };

  const hRowRaw = rows[headerRowIdx];
  const hRow = hRowRaw.map((c) => String(c ?? '').toLowerCase().replace(/\s+/g, ' ').trim());
  const findCol = (...matchers) => {
    for (const m of matchers) { const idx = hRow.findIndex((h) => (typeof m === 'function' ? m(h) : h === m || h.includes(m))); if (idx >= 0) return idx; }
    return -1;
  };
  const idxItem = findCol((h) => h === 'item' || h === 'item.');
  const idxDesc = findCol('descrição', 'descricao', 'descriçao', 'descr');
  const idxUnd = findCol((h) => h === 'und' || h === 'unidade' || h.startsWith('unid'));
  if (idxItem < 0 || idxDesc < 0) return { error: 'Colunas obrigatórias não detectadas (Item/Descrição).', debug: { headerRowIdx, hRow: hRowRaw } };

  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const periodoIdxs = [];
  const periodoLabels = [];
  for (let c = 0; c < hRow.length; c++) {
    if (c === idxItem || c === idxDesc || c === idxUnd) continue;
    const h = hRow[c];
    const isPeriodo = (/per[ií]odo/.test(h) || /\d+º/.test(h) || /\d+o/.test(h) || /\d{1,2}\/(\d{2}|\d{4})/.test(h) || meses.some((m) => h.startsWith(m)));
    if (isPeriodo) { periodoIdxs.push(c); periodoLabels.push(String(hRowRaw[c] ?? `Período ${c}`)); }
  }
  if (periodoIdxs.length === 0) {
    for (let c = Math.max(idxDesc, idxUnd) + 1; c < hRow.length && periodoIdxs.length < 24; c++) { periodoIdxs.push(c); periodoLabels.push(String(hRowRaw[c] ?? `Período ${c}`)); }
  }
  if (periodoIdxs.length === 0) return { error: 'Não identifiquei colunas de períodos. Renomeie os cabeçalhos (ex.: "1º Período", "Jan/2026").' };

  const itens = [];
  const totalPorPeriodo = {};
  periodoLabels.forEach((l) => { totalPorPeriodo[l] = { valor: 0, percent: 0 }; });
  let ordem = 0;
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const itemRaw = String(row[idxItem] ?? '').trim();
    const descRaw = String(row[idxDesc] ?? '').trim();
    if (!itemRaw) continue;
    // Ignorar APENAS a linha de assinatura/rodapé (ex.: "____ ENIO PEREIRA
    // SILVA ... CREA"), identificada por 3+ sublinhados seguidos. As linhas de
    // resumo (Porcentagem/Custo/Acumulados) carregam os valores em R$ e DEVEM
    // ser mantidas — elas alimentam os totais por período e o gráfico.
    if (/_{3,}/.test(itemRaw) || /_{3,}/.test(descRaw)) continue;
    const isGrupo = /^\d+$/.test(itemRaw);
    const grupoPai = isGrupo ? null : (itemRaw.includes('.') ? itemRaw.split('.').slice(0, -1).join('.') : null);
    const nivel = isGrupo ? 0 : itemRaw.split('.').length;
    const periodos = {};
    let totalValorItem = 0;
    for (let i = 0; i < periodoIdxs.length; i++) {
      const col = periodoIdxs[i];
      const label = periodoLabels[i];
      const raw = row[col];
      const num = parseValorBR(raw);
      let percent = 0, valor = 0;
      if (typeof raw === 'string' && /%/.test(raw)) percent = Math.max(0, Math.min(100, num));
      else if (num <= 1 && num > 0) percent = Math.round(num * 10000) / 100;
      else if (num > 0 && num <= 100) percent = num;
      else if (num > 100) valor = num;
      if (percent > 0 || valor > 0) { periodos[label] = { percent, valor }; totalPorPeriodo[label].valor += valor; totalPorPeriodo[label].percent += percent; totalValorItem += valor; }
    }
    itens.push({ item: itemRaw, descricao: descRaw, und: idxUnd >= 0 ? String(row[idxUnd] ?? '').trim() : '', is_grupo: isGrupo, grupo_pai: grupoPai, nivel, ordem: ordem++, periodos, total_valor: totalValorItem });
  }

  return {
    sucesso: true,
    arquivo_nome: arquivo_nome || 'cronograma.xlsx',
    sheet_name: sheetName,
    periodos_labels: periodoLabels,
    itens,
    meta: { total_por_periodo: totalPorPeriodo, total_geral: Object.values(totalPorPeriodo).reduce((s, v) => s + (v.valor || 0), 0) },
    resumo: { linhas: itens.length, periodos: periodoLabels.length },
  };
}
