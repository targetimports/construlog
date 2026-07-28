// ─────────────────────────────────────────────────────────────────────────
// Padrão CSV do sistema (pt-BR / Excel): BOM UTF-8 + separador ';' + células
// com aspas escapando aspas internas. Evita colunas coladas e acentos quebrados
// ao abrir no Excel brasileiro. Use em todo export CSV do front-end.
// ─────────────────────────────────────────────────────────────────────────

export function celulaCSV(x) {
  const s = String(x ?? '');
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Monta a string CSV (com BOM) a partir de uma matriz de linhas (arrays).
export function montarCSV(linhas) {
  return '﻿' + (linhas || []).map((l) => (Array.isArray(l) ? l : [l]).map(celulaCSV).join(';')).join('\r\n');
}

// Dispara o download de um conteúdo CSV já montado.
export function baixarCSV(nomeArquivo, conteudo) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo.toLowerCase().endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Conveniência: recebe cabeçalho + linhas (arrays) e baixa o CSV padronizado.
export function exportarCSV(nomeArquivo, headers, rows) {
  baixarCSV(nomeArquivo, montarCSV([headers, ...(rows || [])]));
}
