import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { materialSelecionado, comparacoes, materiais, fornecedores } = await req.json();

    if (!comparacoes || comparacoes.length === 0) {
      return Response.json({ error: 'Nenhuma comparação disponível' }, { status: 400 });
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Header com background
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPARATIVO DE FORNECEDORES', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}`, pageWidth / 2, 30, { align: 'center' });
    doc.text(`Responsável: ${user.full_name}`, pageWidth / 2, 37, { align: 'center' });

    yPosition = 60;
    doc.setTextColor(0, 0, 0);

    // Cards de resumo - 4 colunas
    const cardWidth = (contentWidth - 15) / 4;
    const cardHeight = 28;
    
    const melhorPreco = Math.min(...comparacoes.map(c => c.preco_unitario || 0));
    const fornecedoresUnicos = new Set(comparacoes.map(c => c.fornecedor_id)).size;
    const prazoMedio = Math.round(comparacoes.reduce((acc, c) => acc + (c.prazo_entrega_dias || 0), 0) / comparacoes.length);
    const economiaPercent = (((Math.max(...comparacoes.map(c => c.preco_unitario || 0)) - melhorPreco) / Math.max(...comparacoes.map(c => c.preco_unitario || 0))) * 100).toFixed(1);

    // Card 1 - Melhor Preço
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Melhor Preço', margin + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${melhorPreco.toFixed(2)}`, margin + cardWidth / 2, yPosition + 20, { align: 'center' });

    // Card 2 - Fornecedores
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin + cardWidth + 5, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Fornecedores', margin + cardWidth + 5 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(fornecedoresUnicos), margin + cardWidth + 5 + cardWidth / 2, yPosition + 20, { align: 'center' });

    // Card 3 - Prazo Médio
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(margin + (cardWidth + 5) * 2, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Prazo Médio', margin + (cardWidth + 5) * 2 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${prazoMedio} dias`, margin + (cardWidth + 5) * 2 + cardWidth / 2, yPosition + 20, { align: 'center' });

    // Card 4 - Economia
    doc.setFillColor(168, 85, 247);
    doc.roundedRect(margin + (cardWidth + 5) * 3, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Economia', margin + (cardWidth + 5) * 3 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${economiaPercent}%`, margin + (cardWidth + 5) * 3 + cardWidth / 2, yPosition + 20, { align: 'center' });

    yPosition += 40;
    doc.setTextColor(0, 0, 0);

    // Agrupar por material
    const comparacoesPorMaterial = comparacoes.reduce((acc, comp) => {
      const key = comp.material_id || 'sem_material';
      if (!acc[key]) acc[key] = [];
      acc[key].push(comp);
      return acc;
    }, {});

    // Título da seção
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPosition, contentWidth, 12, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('COMPARAÇÕES POR MATERIAL', margin + 3, yPosition + 8);
    doc.setTextColor(0, 0, 0);
    yPosition += 18;

    // Comparações por material
    for (const [materialId, comps] of Object.entries(comparacoesPorMaterial)) {
      const material = materiais.find(m => m.id === materialId);
      const ordenadas = comps.sort((a, b) => (a.preco_unitario || 0) - (b.preco_unitario || 0));
      const melhorPrecoMaterial = ordenadas[0]?.preco_unitario || 0;

      if (yPosition > pageHeight - 85) {
        doc.addPage();
        yPosition = margin + 10;
      }

      // Header do material
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text(material?.nome || 'Material não identificado', margin + 4, yPosition + 8);
      
      doc.setFillColor(219, 234, 254);
      const badgeWidth = 25;
      doc.roundedRect(margin + contentWidth - badgeWidth - 2, yPosition + 2, badgeWidth, 8, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setTextColor(37, 99, 235);
      doc.text(`${comps.length} cotações`, margin + contentWidth - badgeWidth / 2 - 2, yPosition + 7, { align: 'center' });

      yPosition += 16;
      doc.setTextColor(0, 0, 0);

      // Listagem de fornecedores
      for (let i = 0; i < ordenadas.length; i++) {
        const comp = ordenadas[i];
        const fornecedor = fornecedores.find(f => f.id === comp.fornecedor_id);
        const economia = melhorPrecoMaterial > 0 ? (((comp.preco_unitario - melhorPrecoMaterial) / melhorPrecoMaterial) * 100) : 0;

        if (yPosition > pageHeight - 35) {
          doc.addPage();
          yPosition = margin + 10;
        }

        // Box do fornecedor
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, yPosition, contentWidth, 22, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, yPosition, contentWidth, 22, 2, 2, 'D');

        // Ranking
        doc.setFillColor(37, 99, 235);
        doc.circle(margin + 6, yPosition + 11, 4, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`#${i + 1}`, margin + 6, yPosition + 12, { align: 'center' });

        // Nome do fornecedor
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(fornecedor?.nome || comp.fornecedor_nome || 'Fornecedor', margin + 14, yPosition + 8);

        // Badge "Melhor Preço"
        if (i === 0) {
          doc.setFillColor(220, 252, 231);
          doc.roundedRect(margin + 14, yPosition + 11, 24, 6, 2, 2, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(21, 128, 61);
          doc.text('MELHOR PREÇO', margin + 26, yPosition + 15, { align: 'center' });
        }

        // Informações
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const infoY = yPosition + 18;
        doc.text(`Min: ${comp.quantidade_minima || 0} ${comp.unidade || 'un'}`, margin + 14, infoY);
        doc.text(`Prazo: ${comp.prazo_entrega_dias || 0} dias`, margin + 50, infoY);
        doc.text(`${comp.condicoes_pagamento || 'À vista'}`, margin + 85, infoY);

        // Preço
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const precoX = margin + contentWidth - 40;
        doc.text(`R$ ${comp.preco_unitario?.toFixed(2) || '0.00'}`, precoX, yPosition + 10, { align: 'right' });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`por ${comp.unidade || 'un'}`, precoX, yPosition + 15, { align: 'right' });

        // Badge economia
        if (economia > 0) {
          doc.setFillColor(254, 226, 226);
          doc.roundedRect(precoX - 25, yPosition + 17, 25, 5, 2, 2, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(185, 28, 28);
          doc.text(`+${economia.toFixed(1)}%`, precoX - 12.5, yPosition + 20, { align: 'center' });
        }

        yPosition += 24;
      }

      yPosition += 5;
    }

    // Footer em todas as páginas
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Construlog Construlog - Comparativo de Fornecedores', margin, pageHeight - 8);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      usuario: user.email,
      acao: 'gerar_relatorio_comparativo_fornecedores',
      entidade: 'ComparacaoFornecedor',
      detalhes: `Relatório com ${comparacoes.length} comparações gerado`,
      data_hora: new Date().toISOString()
    }).catch(() => {});

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=comparativo-fornecedores-${new Date().toISOString().split('T')[0]}.pdf`
      }
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return Response.json({ 
      error: 'Erro ao gerar relatório',
      details: error.message 
    }, { status: 500 });
  }
});