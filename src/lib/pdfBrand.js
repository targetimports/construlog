import jsPDF from 'jspdf';

// ─────────────────────────────────────────────────────────────────────────
// Kit de branding para PDFs do sistema (a "cara" padrão dos relatórios).
// Extraído de boletimMedicaoPdf.js (padrão-ouro) para reuso em todos os PDFs:
// cabeçalho com logo + dados da empresa, régua azul de destaque e rodapé com
// nome da empresa/sistema + data de geração + paginação em TODA página.
// ─────────────────────────────────────────────────────────────────────────

export const PDF_ACCENT = [37, 99, 235];   // azul do sistema (#2563EB)
export const PDF_INK = [17, 24, 39];        // texto forte
export const PDF_MUTE = [107, 114, 128];    // texto secundário
export const PDF_STRIPE = [248, 250, 252];  // zebra das tabelas
export const PDF_LINE = [226, 232, 240];    // linhas/bordas

// Carrega uma imagem (mesma origem) e devolve um PNG dataURL + proporção.
export function carregarImagemPDF(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        // Achata a transparência sobre branco — PNG transparente renderiza sujo no PDF.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function novoPDF(opts = {}) {
  return new jsPDF({ unit: 'mm', format: 'a4', ...opts });
}

/**
 * Desenha o cabeçalho de marca (logo + empresa + título) e devolve o Y para
 * continuar o conteúdo. Chame no início da geração de qualquer PDF do sistema.
 */
export async function cabecalhoPDF(doc, { empresa = {}, branding = {}, titulo = '', subtitulo = '', y = 12, margin = 14 } = {}) {
  const PW = doc.internal.pageSize.getWidth();
  const M = margin;
  const nomeEmpresa = empresa.razao_social || empresa.nome || branding.nome || 'Construlog';
  const logo = await carregarImagemPDF(empresa.logo_url || branding.logo_url);

  if (logo) {
    // Encaixa a logo numa caixa máx. (largura×altura) PRESERVANDO a proporção —
    // funciona p/ qualquer imagem (quadrada, larga, alta) sem esticar.
    const maxH = 8, maxW = 38;
    const ratio = (logo.w && logo.h) ? logo.w / logo.h : 3;
    let h = maxH, w = maxH * ratio;
    if (w > maxW) { w = maxW; h = maxW / ratio; }
    try { doc.addImage(logo.dataUrl, 'PNG', M, y, w, h); } catch { /* ignora */ }
  }
  doc.setTextColor(...PDF_INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(nomeEmpresa, PW - M, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_MUTE);
  const linhasEmpresa = [
    empresa.cnpj && `CNPJ: ${empresa.cnpj}`,
    empresa.endereco || empresa.endereco_completo,
    [empresa.telefone, empresa.email].filter(Boolean).join(' · '),
  ].filter(Boolean);
  let yi = y + 9;
  linhasEmpresa.forEach((l) => { doc.text(String(l), PW - M, yi, { align: 'right' }); yi += 4; });

  y = Math.max(y + 13, yi + 1);
  doc.setDrawColor(...PDF_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, y, PW - M, y);
  y += 8;

  if (titulo) {
    doc.setTextColor(...PDF_INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(String(titulo), M, y);
    if (subtitulo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_MUTE);
      doc.text(String(subtitulo), PW - M, y, { align: 'right' });
    }
    y += 8;
  }
  return y;
}

/**
 * Desenha o rodapé em TODAS as páginas (nome da empresa + título + data + Pág x/y).
 * Chame por último, logo antes de doc.save().
 */
export function rodapePDF(doc, { empresa = {}, branding = {}, titulo = '', margin = 14 } = {}) {
  const nomeEmpresa = empresa.razao_social || empresa.nome || branding.nome || 'Construlog';
  const total = doc.internal.getNumberOfPages();
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = margin;
  const quando = new Date().toLocaleString('pt-BR');
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_LINE);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 12, PW - M, PH - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_MUTE);
    doc.text([nomeEmpresa, titulo].filter(Boolean).join(' · '), M, PH - 8);
    doc.text(`Gerado em ${quando}  ·  Pág. ${i}/${total}`, PW - M, PH - 8, { align: 'right' });
  }
}

// Estilos padrão para jspdf-autotable (cabeçalho azul + zebra do sistema).
export function temaAutoTable(extra = {}) {
  return {
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: PDF_INK, lineColor: PDF_LINE, ...(extra.styles || {}) },
    headStyles: { fillColor: PDF_ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', ...(extra.headStyles || {}) },
    alternateRowStyles: { fillColor: PDF_STRIPE, ...(extra.alternateRowStyles || {}) },
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => !['styles', 'headStyles', 'alternateRowStyles'].includes(k))),
  };
}
