import XLSX from 'xlsx-js-style';

// ─────────────────────────────────────────────────────────────────────────
// Kit de branding para EXCEL (.xlsx) — a "cara" padrão das planilhas do
// sistema, irmão do pdfBrand.js: bloco de título com empresa + relatório +
// data de geração, cabeçalho azul (#2563EB) com texto branco, zebra nas
// linhas, bordas suaves, larguras de coluna e formato de moeda (R$).
// Usa xlsx-js-style (mesma API do SheetJS + suporte a estilos).
// ─────────────────────────────────────────────────────────────────────────

const AZUL = '2563EB';
const INK = '111827';
const MUTE = '6B7280';
const ZEBRA = 'F8FAFC';
const LINHA = 'E2E8F0';

const bordaFina = {
  top: { style: 'thin', color: { rgb: LINHA } },
  bottom: { style: 'thin', color: { rgb: LINHA } },
  left: { style: 'thin', color: { rgb: LINHA } },
  right: { style: 'thin', color: { rgb: LINHA } },
};

// Formato de moeda pt-BR (o Excel aplica separadores conforme o locale).
export const FMT_MOEDA = 'R$ #,##0.00';
export const FMT_PCT = '0.00"%"';

/**
 * Monta UMA aba (worksheet) branded.
 * @param {object} p
 *  - titulo: título do relatório (ex.: 'Relatório Financeiro')
 *  - subtitulo: contexto (ex.: nome da obra/período) — opcional
 *  - headers: array com os rótulos das colunas
 *  - rows: array de arrays (valores crus; números como Number p/ formato funcionar)
 *  - larguras: array de números (wch) — opcional (senão calcula pelo conteúdo)
 *  - moeda: índices (0-based) das colunas com formato R$ — opcional
 *  - percentual: índices das colunas com formato % — opcional
 *  - empresa/branding: como em pdfBrand (razao_social/nome/cnpj; branding.nome)
 */
export function abaBranded({ titulo = '', subtitulo = '', headers = [], rows = [], larguras, moeda = [], percentual = [], empresa = {}, branding = {} }) {
  const nomeEmpresa = empresa.razao_social || empresa.nome || branding.nome || 'Construlog';
  const nCols = Math.max(headers.length, 1);
  const geradoEm = `Gerado em ${new Date().toLocaleString('pt-BR')}`;

  // Linhas 1-3: bloco de identificação; linha 4 em branco; linha 5: cabeçalho.
  const aoa = [
    [nomeEmpresa + (empresa.cnpj ? `  ·  CNPJ: ${empresa.cnpj}` : '')],
    [titulo + (subtitulo ? ` — ${subtitulo}` : '')],
    [geradoEm],
    [],
    headers,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merges do bloco de título (uma célula atravessando todas as colunas).
  ws['!merges'] = [0, 1, 2].map((r) => ({ s: { r, c: 0 }, e: { r, c: nCols - 1 } }));

  // Estilos do bloco de título.
  const setS = (addr, s) => { if (ws[addr]) ws[addr].s = s; };
  setS('A1', { font: { bold: true, sz: 13, color: { rgb: INK } } });
  setS('A2', { font: { bold: true, sz: 11, color: { rgb: AZUL } } });
  setS('A3', { font: { sz: 9, color: { rgb: MUTE } } });

  const headerRow = 4; // 0-based (linha 5 visível)
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: AZUL } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: bordaFina,
    };
  }

  // Linhas de dados: zebra + bordas + formatos numéricos.
  for (let i = 0; i < rows.length; i++) {
    const r = headerRow + 1 + i;
    const zebra = i % 2 === 1;
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      const cell = ws[addr];
      const ehNum = cell.t === 'n';
      cell.s = {
        font: { sz: 10, color: { rgb: INK } },
        border: bordaFina,
        alignment: { horizontal: ehNum ? 'right' : 'left', vertical: 'center' },
        ...(zebra ? { fill: { patternType: 'solid', fgColor: { rgb: ZEBRA } } } : {}),
      };
      if (ehNum && moeda.includes(c)) cell.z = FMT_MOEDA;
      else if (ehNum && percentual.includes(c)) cell.z = FMT_PCT;
    }
  }

  // Larguras: usa as passadas ou calcula pelo conteúdo (cap 60).
  ws['!cols'] = (larguras && larguras.length ? larguras : headers.map((h, c) => {
    const maxDado = rows.reduce((m, row) => Math.max(m, String(row[c] ?? '').length), 0);
    return Math.min(60, Math.max(String(h).length + 2, maxDado + 2, 10));
  })).map((wch) => ({ wch }));

  // Altura do bloco de título e do cabeçalho.
  ws['!rows'] = [{ hpt: 20 }, { hpt: 16 }, { hpt: 12 }, { hpt: 6 }, { hpt: 18 }];

  // Autofiltro no cabeçalho (facilita o uso no Excel).
  if (rows.length && headers.length) {
    ws['!autofilter'] = {
      ref: `${XLSX.utils.encode_cell({ r: headerRow, c: 0 })}:${XLSX.utils.encode_cell({ r: headerRow + rows.length, c: headers.length - 1 })}`,
    };
  }

  return ws;
}

/**
 * Gera e baixa um .xlsx branded com uma ou mais abas.
 * @param {string} filename  nome do arquivo (com ou sem .xlsx)
 * @param {Array}  abas      [{ nome, titulo, subtitulo, headers, rows, larguras?, moeda?, percentual? }]
 * @param {object} ctx       { empresa, branding } (de useEmpresaBranding)
 */
export function exportarXLSXBranded(filename, abas, ctx = {}) {
  const wb = XLSX.utils.book_new();
  for (const aba of abas) {
    const ws = abaBranded({ ...aba, empresa: ctx.empresa || {}, branding: ctx.branding || {} });
    XLSX.utils.book_append_sheet(wb, ws, String(aba.nome || 'Dados').slice(0, 31));
  }
  XLSX.writeFile(wb, filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
