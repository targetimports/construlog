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

    const { composicao_id } = await req.json();

    if (!composicao_id) {
      return Response.json({ error: 'composicao_id obrigatório' }, { status: 400 });
    }

    // Busca composição
    const composicoes = await base44.asServiceRole.entities.Composicao.filter({ id: composicao_id });
    if (!composicoes || composicoes.length === 0) {
      return Response.json({ error: 'Composição não encontrada' }, { status: 404 });
    }

    const composicao = composicoes[0];

    // Busca insumos
    const relacoes = await base44.asServiceRole.entities.ComposicaoInsumo.filter({
      composicao_id: composicao_id
    });

    const insumosData = await Promise.all(
      relacoes.map(async (rel) => {
        const insumos = await base44.asServiceRole.entities.Insumo.filter({ id: rel.insumo_id });
        return {
          ...rel,
          insumo: insumos[0]
        };
      })
    );

    // Cria PDF
    const doc = new jsPDF();

    // Título
    doc.setFontSize(18);
    doc.text('COMPOSIÇÃO DE CUSTO', 20, 20);

    // Dados da composição
    doc.setFontSize(10);
    doc.text(`Código: ${composicao.codigo}`, 20, 35);
    doc.text(`Descrição: ${composicao.descricao}`, 20, 42);
    doc.text(`Unidade: ${composicao.unidade}`, 20, 49);
    doc.text(`Fonte: ${composicao.fonte}`, 120, 35);
    doc.text(`Data Base: ${composicao.data_base ? new Date(composicao.data_base).toLocaleDateString('pt-BR') : '-'}`, 120, 42);
    doc.text(`BDI: ${composicao.bdi_padrao || 0}%`, 120, 49);

    // Custo unitário
    doc.setFontSize(12);
    doc.text(`Custo Unitário: R$ ${(composicao.custo_unitario || 0).toFixed(2)}`, 20, 60);

    // Tabela de insumos
    const tableData = insumosData.map(item => [
      item.insumo?.codigo || '-',
      item.insumo?.descricao || '-',
      item.insumo?.tipo || '-',
      item.coeficiente?.toFixed(4) || '0',
      `R$ ${(item.insumo?.preco_unitario || 0).toFixed(2)}`,
      `R$ ${(item.custo_parcial || 0).toFixed(2)}`
    ]);

    doc.autoTable({
      startY: 70,
      head: [['Código', 'Descrição', 'Tipo', 'Coef.', 'Preço Unit.', 'Custo Parcial']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 }
      }
    });

    // Total
    const finalY = doc.lastAutoTable.finalY + 10;
    const custoTotal = insumosData.reduce((sum, item) => sum + (item.custo_parcial || 0), 0);
    
    doc.setFontSize(11);
    doc.text(`Custo Total (sem BDI): R$ ${custoTotal.toFixed(2)}`, 20, finalY);
    
    if (composicao.bdi_padrao > 0) {
      doc.text(`BDI (${composicao.bdi_padrao}%): R$ ${(custoTotal * composicao.bdi_padrao / 100).toFixed(2)}`, 20, finalY + 7);
      doc.setFontSize(12);
      doc.text(`Preço de Venda: R$ ${(custoTotal * (1 + composicao.bdi_padrao / 100)).toFixed(2)}`, 20, finalY + 15);
    }

    // Rodapé
    doc.setFontSize(8);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 20, 285);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=composicao_${composicao.codigo}.pdf`
      }
    });
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});