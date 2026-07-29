import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';
import 'npm:jspdf-autotable@3.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, tipo, periodo } = await req.json();

    // Buscar dados
    const obras = await base44.entities.Obra.filter({ id: obra_id });
    const obra = obras[0];

    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    const medicoes = await base44.entities.Medicao.filter({ obra_id, status: 'aprovada' }, '-created_date');
    const orcamentos = await base44.entities.Orcamento.filter({ obra_id, status: 'vigente' });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11);
    doc.text('CONSTRULOG CONSTRULOG', 20, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`Relatório - ${obra.nome}`, 20, 35);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);
    doc.text(`Por: ${user.email}`, 20, 47);

    let yPos = 60;

    if (tipo === 'progresso') {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Progresso Físico-Financeiro', 20, yPos);
      yPos += 10;

      // Resumo
      doc.setFontSize(10);
      doc.text(`Status: ${obra.status}`, 20, yPos);
      doc.text(`Progresso Físico: ${(obra.percentual_concluido || 0).toFixed(2)}%`, 100, yPos);
      yPos += 7;
      doc.text(`Valor Contrato: R$ ${(obra.valor_contrato || 0).toLocaleString('pt-BR')}`, 20, yPos);
      doc.text(`Valor Realizado: R$ ${(obra.valor_realizado || 0).toLocaleString('pt-BR')}`, 100, yPos);
      yPos += 15;

      // Tabela de medições
      const medicoesData = medicoes.map(m => [
        m.numero,
        new Date(m.periodo_inicio).toLocaleDateString('pt-BR'),
        new Date(m.periodo_fim).toLocaleDateString('pt-BR'),
        `${m.percentual_fisico_periodo?.toFixed(2)}%`,
        `${m.percentual_fisico_acumulado?.toFixed(2)}%`,
        `R$ ${(m.valor_medido || 0).toLocaleString('pt-BR')}`
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Medição', 'Início', 'Fim', '% Período', '% Acumulado', 'Valor']],
        body: medicoesData,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] }
      });

    } else if (tipo === 'custos') {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Controle de Custos - Orçado vs Realizado', 20, yPos);
      yPos += 15;

      const orcamento = orcamentos[0];
      
      const custosData = [
        ['Valor Orçado', `R$ ${(orcamento?.valor_total || 0).toLocaleString('pt-BR')}`],
        ['Valor Realizado', `R$ ${(obra.valor_realizado || 0).toLocaleString('pt-BR')}`],
        ['Valor Contrato', `R$ ${(obra.valor_contrato || 0).toLocaleString('pt-BR')}`],
        ['Variação (%)', orcamento?.valor_total 
          ? `${(((obra.valor_realizado || 0) / orcamento.valor_total - 1) * 100).toFixed(2)}%`
          : 'N/A']
      ];

      doc.autoTable({
        startY: yPos,
        body: custosData,
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { halign: 'right' }
        }
      });

      if (orcamento) {
        yPos = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(12);
        doc.text('Distribuição por Categoria', 20, yPos);
        yPos += 10;

        const distribuicaoData = [
          ['Materiais', `R$ ${(orcamento.valor_total_materiais || 0).toLocaleString('pt-BR')}`],
          ['Mão de Obra', `R$ ${(orcamento.valor_total_mao_obra || 0).toLocaleString('pt-BR')}`],
          ['Equipamentos', `R$ ${(orcamento.valor_total_equipamentos || 0).toLocaleString('pt-BR')}`],
          ['Transporte', `R$ ${(orcamento.valor_total_transporte || 0).toLocaleString('pt-BR')}`]
        ];

        doc.autoTable({
          startY: yPos,
          body: distribuicaoData,
          theme: 'striped',
          headStyles: { fillColor: [245, 158, 11] }
        });
      }

    } else if (tipo === 'medicoes') {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Resumo de Medições', 20, yPos);
      yPos += 10;

      const resumoData = medicoes.map(m => [
        m.numero,
        `${new Date(m.periodo_inicio).toLocaleDateString('pt-BR')} - ${new Date(m.periodo_fim).toLocaleDateString('pt-BR')}`,
        `${m.percentual_fisico_periodo?.toFixed(2)}%`,
        `${m.percentual_fisico_acumulado?.toFixed(2)}%`,
        `R$ ${(m.valor_medido || 0).toLocaleString('pt-BR')}`,
        m.status
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Nº', 'Período', '% Período', '% Acum', 'Valor', 'Status']],
        body: resumoData,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] }
      });

      // Totais
      const totalMedido = medicoes.reduce((acc, m) => acc + (m.valor_medido || 0), 0);
      yPos = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Medido: R$ ${totalMedido.toLocaleString('pt-BR')}`, 20, yPos);
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=relatorio-${tipo}-${obra.nome}.pdf`
      }
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});