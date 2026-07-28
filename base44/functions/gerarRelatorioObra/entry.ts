import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';
import 'npm:jspdf-autotable';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { obra_id, tipo_relatorio, opcoes } = payload;

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados da obra
    const obra = await base44.entities.Obra.read(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Buscar cronograma
    const cronogramas = await base44.entities.CronogramaItem.filter({ obra_id });
    
    // Buscar dados financeiros
    const lancamentos = await base44.entities.LancamentoFinanceiro.filter({ obra_id });
    
    // Buscar medicões
    const medicoes = await base44.entities.Medicao.filter({ obra_id });

    // Criar PDF
    const doc = new jsPDF();
    let yPosition = 10;

    // Cabeçalho
    doc.setFontSize(20);
    doc.text('Relatório de Obra', 10, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.text(`Obra: ${obra.nome}`, 10, yPosition);
    yPosition += 5;
    doc.text(`Cliente: ${obra.cliente_nome || 'N/A'}`, 10, yPosition);
    yPosition += 5;
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 10, yPosition);
    yPosition += 10;

    // Progresso
    if (opcoes?.incluir_progresso) {
      doc.setFontSize(14);
      doc.text('Progresso Físico', 10, yPosition);
      yPosition += 8;

      const totalCronogramas = cronogramas.length;
      const cronogramasFinalizados = cronogramas.filter(c => c.status === 'concluida').length;
      const percentualProgresso = totalCronogramas > 0 ? ((cronogramasFinalizados / totalCronogramas) * 100).toFixed(2) : 0;

      doc.setFontSize(11);
      doc.text(`Atividades Concluídas: ${cronogramasFinalizados}/${totalCronogramas} (${percentualProgresso}%)`, 10, yPosition);
      yPosition += 10;
    }

    // Custos
    if (opcoes?.incluir_custos) {
      doc.setFontSize(14);
      doc.text('Custos', 10, yPosition);
      yPosition += 8;

      const totalCustos = lancamentos.reduce((sum, l) => sum + (l.valor || 0), 0);
      doc.setFontSize(11);
      doc.text(`Custo Total: R$ ${totalCustos.toFixed(2)}`, 10, yPosition);
      yPosition += 10;
    }

    // Cronograma
    if (opcoes?.incluir_cronograma && cronogramas.length > 0) {
      doc.setFontSize(14);
      doc.text('Cronograma', 10, yPosition);
      yPosition += 8;

      const tableData = cronogramas.slice(0, 5).map(c => [
        c.titulo || 'N/A',
        c.data_inicio ? new Date(c.data_inicio).toLocaleDateString('pt-BR') : 'N/A',
        c.data_fim ? new Date(c.data_fim).toLocaleDateString('pt-BR') : 'N/A',
        c.status || 'N/A'
      ]);

      doc.autoTable({
        head: [['Atividade', 'Início', 'Fim', 'Status']],
        body: tableData,
        startY: yPosition,
        margin: 10
      });

      yPosition = doc.lastAutoTable.finalY + 10;
    }

    const pdfBuffer = doc.output('arraybuffer');
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio_${obra.nome}_${new Date().toISOString().split('T')[0]}.pdf"`
      }
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});