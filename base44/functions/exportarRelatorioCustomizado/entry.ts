import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.1';
import autoTable from 'npm:jspdf-autotable@3.8.2';
import * as XLSX from 'npm:xlsx@0.18.5';

// ─── Fetch & process (mesma lógica do gerarRelatorioCustomizado) ────────────
async function fetchAndProcess(base44, relatorio) {
  async function fetchData(fonte) {
    switch (fonte) {
      case 'obras':         return base44.asServiceRole.entities.Obra.list('-created_date', 2000);
      case 'financeiro':    return base44.asServiceRole.entities.ContaFinanceira.list('-created_date', 2000);
      case 'compras':       return base44.asServiceRole.entities.RequisicaoCompra.list('-created_date', 2000);
      case 'estoque':       return base44.asServiceRole.entities.SaldoEstoque.list('-created_date', 2000);
      case 'medicoes':      return base44.asServiceRole.entities.MedicaoObra.list('-created_date', 2000);
      case 'ordens_compra': return base44.asServiceRole.entities.OrdemCompra.list('-created_date', 2000);
      default:              return [];
    }
  }

  const raw = await fetchData(relatorio.fonte_dados);

  // filtros
  let data = (relatorio.filtros || []).length > 0
    ? raw.filter(item => relatorio.filtros.every(({ campo, operador, valor }) => {
        const v = item[campo];
        switch (operador) {
          case 'igual':     return String(v ?? '') === String(valor);
          case 'diferente': return String(v ?? '') !== String(valor);
          case 'contem':    return String(v ?? '').toLowerCase().includes(String(valor).toLowerCase());
          case 'maior_que': return Number(v) > Number(valor);
          case 'menor_que': return Number(v) < Number(valor);
          case 'entre': {
            const [min, max] = String(valor).split(',').map(x => Number(x.trim()));
            return Number(v) >= min && Number(v) <= max;
          }
          default: return true;
        }
      }))
    : raw;

  // ordenação
  if (relatorio.ordenacao) {
    data = [...data].sort((a, b) => {
      const av = a[relatorio.ordenacao]; const bv = b[relatorio.ordenacao];
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (relatorio.ordem_direcao === 'desc' ? -1 : 1);
    });
  }

  // agrupamento
  if (relatorio.agrupamento) {
    const groups = {};
    for (const item of data) {
      const k = String(item[relatorio.agrupamento] ?? '(vazio)');
      if (!groups[k]) groups[k] = { _grupo: k, _count: 0 };
      groups[k]._count++;
      for (const f of ['valor', 'valor_orcado', 'valor_realizado', 'valor_total_estimado', 'valor_medicao']) {
        if (item[f] != null) groups[k][f] = (groups[k][f] || 0) + Number(item[f]);
      }
    }
    data = Object.values(groups);
  }

  const campos = (relatorio.campos_visibles && relatorio.campos_visibles.length > 0)
    ? relatorio.campos_visibles
    : Object.keys(raw[0] || {}).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 8);

  const colsList = relatorio.agrupamento
    ? ['_grupo', '_count', ...campos.filter(c => c !== relatorio.agrupamento)]
    : campos;

  const rows = data.map(item => colsList.map(c => item[c] ?? ''));

  return { rows, headers: colsList, totalRegistros: data.length };
}

// ─── CSV ────────────────────────────────────────────────────────────────────
function toCSV(headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return lines.join('\n');
}

// ─── XLSX ───────────────────────────────────────────────────────────────────
function toXLSX(headers, rows, sheetName) {
  const wsData = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // largura das colunas
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Relatório');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
}

// ─── PDF ────────────────────────────────────────────────────────────────────
function toPDF(relatorio, headers, rows, totalRegistros) {
  const doc = new jsPDF({ orientation: rows.length > 0 && headers.length > 6 ? 'landscape' : 'portrait' });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(relatorio.nome || 'Relatório', 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}  |  Total: ${totalRegistros} registros`, 14, 28);
  if (relatorio.descricao) doc.text(relatorio.descricao, 14, 34);

  const startY = relatorio.descricao ? 40 : 34;

  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(v => String(v ?? ''))),
    startY,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [67, 97, 238], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 248, 250] },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  return doc.output('arraybuffer');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { relatorioId, format } = body;

    if (!relatorioId) return Response.json({ error: 'relatorioId obrigatório' }, { status: 400 });
    if (!['csv', 'xlsx', 'pdf'].includes(format)) return Response.json({ error: 'format deve ser csv, xlsx ou pdf' }, { status: 400 });

    const relatorios = await base44.entities.RelatorioCustomizado.filter({ id: relatorioId });
    const relatorio = relatorios?.[0];
    if (!relatorio) return Response.json({ ok: false, error: 'Relatório não encontrado' }, { status: 404 });

    const { rows, headers, totalRegistros } = await fetchAndProcess(base44, relatorio);

    const filename = (relatorio.nome || 'relatorio').replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (format === 'csv') {
      const csv = toCSV(headers, rows);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        }
      });
    }

    if (format === 'xlsx') {
      const b64 = toXLSX(headers, rows, relatorio.nome);
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        }
      });
    }

    if (format === 'pdf') {
      const buffer = toPDF(relatorio, headers, rows, totalRegistros);
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        }
      });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});