import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@2.5.2';
import 'npm:jspdf-autotable@3.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, empresa } = await req.json();

    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId });
    const items = await base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId });
    const obra = await base44.entities.Obra.filter({ id: orcamento[0].obra_id });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 116, 204);
    doc.text('PROPOSTA COMERCIAL', pageWidth / 2, 20, { align: 'center' });

    // Empresa info
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${empresa?.nome || 'Sua Empresa'}`, 20, 35);
    doc.text(`CNPJ: ${empresa?.cnpj || ''}`, 20, 42);
    doc.text(`${empresa?.endereco || ''}`, 20, 49);

    // Proposta info
    doc.setFontSize(12);
    doc.setTextColor(40, 116, 204);
    doc.text('INFORMAÇÕES DA PROPOSTA', 20, 65);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Obra: ${obra[0]?.nome}`, 20, 75);
    doc.text(`Cliente: ${obra[0]?.cliente}`, 20, 82);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 89);
    doc.text(`Válida por: 30 dias`, 20, 96);

    // Tabela de itens
    const tableData = items.map(item => [
      item.codigo || '-',
      item.descricao,
      item.quantidade,
      item.unidade,
      `R$ ${(item.valor_unitario || 0).toFixed(2)}`,
      `R$ ${(item.valor_total || 0).toFixed(2)}`
    ]);

    doc.autoTable({
      head: [['Código', 'Descrição', 'Qtd', 'Un', 'V. Unit.', 'V. Total']],
      body: tableData,
      startY: 110,
      styles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        fillColor: [245, 245, 245]
      },
      headStyles: {
        fillColor: [40, 116, 204],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      }
    });

    // Totals
    const totalValue = items.reduce((acc, item) => acc + (item.valor_total || 0), 0);
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(40, 116, 204);
    doc.text(`VALOR TOTAL: R$ ${totalValue.toFixed(2)}`, pageWidth - 20, finalY, { align: 'right' });

    // Condições
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Condições de Pagamento: A combinar', 20, pageHeight - 40);
    doc.text('Observações: Esta proposta é válida por 30 dias a contar da data acima.', 20, pageHeight - 30);
    doc.text('Qualquer alteração deverá ser formalizada por escrito.', 20, pageHeight - 20);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=proposta-${orcamentoId}.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});