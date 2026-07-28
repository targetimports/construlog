import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const obras = await base44.entities.Obra.list();
    const equipes = await base44.entities.Equipe.list();

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
    doc.text('RELATÓRIO DE GESTÃO DE OBRAS', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}`, pageWidth / 2, 30, { align: 'center' });
    doc.text(`Responsável: ${user.full_name}`, pageWidth / 2, 37, { align: 'center' });

    yPosition = 60;
    doc.setTextColor(0, 0, 0);

    // Cards de resumo - 4 colunas
    const cardWidth = (contentWidth - 15) / 4;
    const cardHeight = 30;
    
    // Card 1 - Total de Obras
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Total de Obras', margin + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(String(obras.length), margin + cardWidth / 2, yPosition + 22, { align: 'center' });

    // Card 2 - Em Andamento
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(margin + cardWidth + 5, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Em Andamento', margin + cardWidth + 5 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(String(obras.filter(o => o.status === 'em_andamento').length), margin + cardWidth + 5 + cardWidth / 2, yPosition + 22, { align: 'center' });

    // Card 3 - Equipes
    doc.setFillColor(168, 85, 247);
    doc.roundedRect(margin + (cardWidth + 5) * 2, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Equipes Ativas', margin + (cardWidth + 5) * 2 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(String(equipes.length), margin + (cardWidth + 5) * 2 + cardWidth / 2, yPosition + 22, { align: 'center' });

    // Card 4 - Valor Total
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(margin + (cardWidth + 5) * 3, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Valor Total', margin + (cardWidth + 5) * 3 + cardWidth / 2, yPosition + 10, { align: 'center' });
    const valorTotal = obras.reduce((sum, o) => sum + (o.valor_contrato || 0), 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const valorTexto = valorTotal >= 1000000 
      ? `R$ ${(valorTotal / 1000000).toFixed(1)}M`
      : `R$ ${(valorTotal / 1000).toFixed(0)}k`;
    doc.text(valorTexto, margin + (cardWidth + 5) * 3 + cardWidth / 2, yPosition + 22, { align: 'center' });

    yPosition += 45;
    doc.setTextColor(0, 0, 0);

    // Título da seção de obras
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPosition, contentWidth, 12, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('DETALHAMENTO DAS OBRAS', margin + 3, yPosition + 8);
    doc.setTextColor(0, 0, 0);
    yPosition += 18;

    for (let i = 0; i < obras.length; i++) {
      const obra = obras[i];
      
      if (yPosition > pageHeight - 85) {
        doc.addPage();
        yPosition = margin + 10;
      }

      // Card da obra com sombra
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPosition, contentWidth, 62, 2, 2, 'FD');

      // Header da obra - fundo azul claro
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin, yPosition, contentWidth, 14, 2, 2, 'F');
      
      // Nome da obra
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      const obraNome = obra.nome || 'Sem nome';
      const maxWidth = contentWidth - 45;
      const nomeLines = doc.splitTextToSize(obraNome, maxWidth);
      doc.text(nomeLines[0], margin + 4, yPosition + 9);

      // Badge de status
      const statusMap = {
        planejamento: { label: 'Planejamento', color: [100, 116, 139] },
        em_andamento: { label: 'Em Andamento', color: [37, 99, 235] },
        pausada: { label: 'Pausada', color: [217, 119, 6] },
        concluida: { label: 'Concluída', color: [22, 163, 74] },
        cancelada: { label: 'Cancelada', color: [220, 38, 38] }
      };

      const status = statusMap[obra.status] || { label: obra.status || 'N/A', color: [100, 116, 139] };
      doc.setFillColor(...status.color);
      doc.roundedRect(margin + contentWidth - 38, yPosition + 3, 35, 8, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(status.label, margin + contentWidth - 20.5, yPosition + 8.5, { align: 'center' });

      // Conteúdo da obra
      doc.setTextColor(0, 0, 0);
      let contentY = yPosition + 22;

      // Coluna esquerda - Informações gerais
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Cliente:', margin + 4, contentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(obra.cliente || 'Não informado', margin + 20, contentY);

      contentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Responsável:', margin + 4, contentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(obra.responsavel_tecnico || 'Não informado', margin + 28, contentY);

      contentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Prazo:', margin + 4, contentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const prazo = obra.data_prevista_fim ? new Date(obra.data_prevista_fim).toLocaleDateString('pt-BR') : 'Não definido';
      doc.text(prazo, margin + 18, contentY);

      contentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Contrato:', margin + 4, contentY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text(`R$ ${(obra.valor_contrato || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 22, contentY);

      // Coluna direita - Progresso e valores
      contentY = yPosition + 22;
      const colRightX = margin + contentWidth / 2 + 10;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Progresso Físico:', colRightX, contentY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(`${obra.percentual_concluido || 0}%`, colRightX + 32, contentY);

      // Barra de progresso
      contentY += 4;
      const barWidth = 55;
      const barHeight = 4;
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(colRightX, contentY, barWidth, barHeight, 1, 1, 'F');
      
      const progressPercent = (obra.percentual_concluido || 0) / 100;
      if (progressPercent > 0) {
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(colRightX, contentY, barWidth * progressPercent, barHeight, 1, 1, 'F');
      }

      contentY += 9;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Orçado:', colRightX, contentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`R$ ${(obra.valor_orcado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colRightX + 18, contentY);

      contentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Realizado:', colRightX, contentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`R$ ${(obra.valor_realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colRightX + 21, contentY);

      yPosition += 68;
    }

    // Footer em todas as páginas
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Linha separadora
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // Texto do rodapé
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text('Germanos Construlog - Sistema de Gestão de Obras', margin, pageHeight - 8);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    const pdfBytes = doc.output('arraybuffer');

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      usuario: user.email,
      acao: 'gerar_relatorio_gestao_obras',
      entidade: 'Obra',
      detalhes: `Relatório de ${obras.length} obras gerado`,
      data_hora: new Date().toISOString()
    }).catch(() => {});

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=relatorio-gestao-obras-${new Date().toISOString().split('T')[0]}.pdf`
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