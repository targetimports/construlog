import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Helpers de formatação ───────────────────────────────────────────────
const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n, d = 2) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n) => `${num(n, 2)}%`;
const dataBR = (d) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? `${d}T12:00:00` : d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
};

// Carrega uma imagem (mesma origem) e devolve um PNG dataURL + proporção.
function carregarImagem(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Cor de destaque (azul do sistema).
const ACCENT = [37, 99, 235];
const INK = [17, 24, 39];
const MUTE = [107, 114, 128];

/**
 * Gera e baixa um Boletim de Medição em PDF, personalizado com a empresa.
 * @param {object} p { medicao, itens, obra, empresa, branding }
 */
export async function gerarBoletimMedicaoPDF({ medicao = {}, itens = [], obra = {}, empresa = {}, branding = {} }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const M = 14;
  let y = 12;

  const nomeEmpresa = empresa.razao_social || empresa.nome || branding.nome || 'Construlog';
  const logoUrl = empresa.logo_url || branding.logo_url;
  const logo = await carregarImagem(logoUrl);

  // ─── Cabeçalho: logo + dados da empresa ───────────────────────────────
  if (logo) {
    const h = 15;
    const w = Math.min(45, (logo.w / logo.h) * h);
    try { doc.addImage(logo.dataUrl, 'PNG', M, y, w, h); } catch { /* ignora */ }
  }
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(nomeEmpresa, PW - M, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTE);
  const linhasEmpresa = [
    empresa.cnpj && `CNPJ: ${empresa.cnpj}`,
    empresa.endereco,
    [empresa.telefone, empresa.email].filter(Boolean).join(' · '),
  ].filter(Boolean);
  let yi = y + 9;
  linhasEmpresa.forEach((l) => { doc.text(String(l), PW - M, yi, { align: 'right' }); yi += 4; });

  y = Math.max(y + 17, yi + 1);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);
  y += 8;

  // ─── Título ───────────────────────────────────────────────────────────
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Boletim de Medição Nº ${medicao.numero || '—'}`, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTE);
  doc.text((medicao.status || '').toUpperCase(), PW - M, y, { align: 'right' });
  y += 8;

  // ─── Bloco de informações (obra/contrato/período) ─────────────────────
  const info = [
    ['Obra', obra.nome || '—'],
    ['Cliente', obra.cliente || obra.cliente_nome || '—'],
    ['Local', [obra.cidade, obra.estado].filter(Boolean).join(' / ') || '—'],
    ['Período', `${dataBR(medicao.periodo_inicio)} a ${dataBR(medicao.periodo_fim)}`],
    ['Data da medição', dataBR(medicao.data_medicao)],
    ['Responsável', medicao.responsavel_email || '—'],
  ];
  doc.setFontSize(9);
  const colW = (PW - 2 * M) / 2;
  info.forEach((par, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * colW;
    const ry = y + row * 7;
    doc.setTextColor(...MUTE);
    doc.setFont('helvetica', 'normal');
    doc.text(`${par[0]}:`, x, ry);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.text(String(par[1]), x + 32, ry, { maxWidth: colW - 34 });
  });
  y += Math.ceil(info.length / 2) * 7 + 4;

  // ─── Progresso físico (3 caixinhas) ───────────────────────────────────
  const prog = [
    ['Físico anterior', pct(medicao.percentual_fisico_anterior)],
    ['Físico do período', pct(medicao.percentual_fisico_periodo)],
    ['Físico acumulado', pct(medicao.percentual_fisico_acumulado)],
  ];
  const boxW = (PW - 2 * M - 8) / 3;
  prog.forEach((b, i) => {
    const x = M + i * (boxW + 4);
    doc.setFillColor(243, 246, 252);
    doc.roundedRect(x, y, boxW, 16, 2, 2, 'F');
    doc.setTextColor(...MUTE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(b[0], x + 4, y + 6);
    doc.setTextColor(...ACCENT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(b[1], x + 4, y + 13);
  });
  y += 22;

  // ─── Tabela de itens ──────────────────────────────────────────────────
  const linhas = (itens || []).map((it, idx) => [
    String(idx + 1),
    it.descricao || '—',
    it.unidade || 'un',
    num(it.quantidade_prevista, 2),
    num(it.quantidade_periodo, 2),
    num(it.quantidade_acumulada ?? ((Number(it.quantidade_anterior) || 0) + (Number(it.quantidade_periodo) || 0)), 2),
    pct(it.percentual_executado),
    brl(it.valor_unitario),
    brl(it.valor_periodo),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Un', 'Qtd Prev.', 'Qtd Período', 'Qtd Acum.', '% Exec.', 'Vlr Unit.', 'Vlr Período']],
    body: linhas.length ? linhas : [['—', 'Sem itens nesta medição', '', '', '', '', '', '', '']],
    theme: 'grid',
    margin: { left: M, right: M },
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: INK, lineColor: [226, 232, 240] },
    headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'right', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 16 },
      7: { halign: 'right', cellWidth: 22 },
      8: { halign: 'right', cellWidth: 24 },
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ─── Resumo financeiro ────────────────────────────────────────────────
  const descontos = Number(medicao.total_descontos) || 0;
  const retencoes = Number(medicao.total_retencoes) || 0;
  const medido = Number(medicao.valor_medido) || (itens || []).reduce((s, i) => s + (Number(i.valor_periodo) || 0), 0);
  const liquido = medicao.valor_liquido != null ? Number(medicao.valor_liquido) : medido - descontos - retencoes;

  if (y > 250) { doc.addPage(); y = 20; }
  const resumo = [
    ['Valor medido no período', brl(medido)],
    ['(-) Descontos', brl(descontos)],
    ['(-) Retenções', brl(retencoes)],
    ['Valor líquido a faturar', brl(liquido)],
  ];
  const rW = 90;
  const rX = PW - M - rW;
  resumo.forEach((r, i) => {
    const ult = i === resumo.length - 1;
    const ry = y + i * 8;
    if (ult) { doc.setFillColor(...ACCENT); doc.roundedRect(rX, ry - 5.5, rW, 8, 1.5, 1.5, 'F'); }
    doc.setFont('helvetica', ult ? 'bold' : 'normal');
    doc.setFontSize(ult ? 10 : 9);
    doc.setTextColor(...(ult ? [255, 255, 255] : INK));
    doc.text(r[0], rX + 3, ry);
    doc.text(r[1], rX + rW - 3, ry, { align: 'right' });
  });
  y += resumo.length * 8 + 6;

  // ─── Observações ──────────────────────────────────────────────────────
  if (medicao.observacoes && String(medicao.observacoes).trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Observações', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTE);
    const obs = doc.splitTextToSize(String(medicao.observacoes), PW - 2 * M);
    doc.text(obs, M, y);
    y += obs.length * 4 + 4;
  }

  // ─── Assinaturas ──────────────────────────────────────────────────────
  if (y > 255) { doc.addPage(); y = 30; }
  y = Math.max(y, 250);
  const assina = ['Responsável Técnico', 'Fiscalização', 'Contratante'];
  const aW = (PW - 2 * M - 16) / 3;
  assina.forEach((a, i) => {
    const x = M + i * (aW + 8);
    doc.setDrawColor(...MUTE);
    doc.setLineWidth(0.3);
    doc.line(x, y, x + aW, y);
    doc.setFontSize(8);
    doc.setTextColor(...MUTE);
    doc.text(a, x + aW / 2, y + 4, { align: 'center' });
  });

  // ─── Rodapé em todas as páginas ───────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  const PH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 12, PW - M, PH - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTE);
    doc.text(`${nomeEmpresa} · Boletim de Medição ${medicao.numero || ''}`, M, PH - 8);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')}  ·  Pág. ${i}/${total}`,
      PW - M, PH - 8, { align: 'right' },
    );
  }

  const nomeArq = `Boletim_Medicao_${medicao.numero || medicao.id || ''}`.replace(/[^\w\-]+/g, '_');
  doc.save(`${nomeArq}.pdf`);
}
