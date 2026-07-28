import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo, obra_id, periodo_inicio, periodo_fim } = await req.json();

    // Buscar dados
    let obras = [];
    if (obra_id) {
      obras = await base44.entities.Obra.filter({ id: obra_id });
    } else {
      obras = await base44.entities.Obra.filter({ 
        status: { $in: ['em_andamento', 'a_iniciar', 'orcamento', 'pausada'] } 
      });
    }

    const contas = await base44.entities.ContaFinanceira.list();
    const medicoes = await base44.entities.Medicao.list();

    // Criar PDF
    const doc = new jsPDF();
    
    // Cabeçalho
    doc.setFontSize(20);
    doc.text('Germanos Construlog', 20, 20);
    doc.setFontSize(14);
    
    if (tipo === 'financeiro') {
      doc.text('Relatório de Progresso Financeiro', 20, 30);
    } else if (tipo === 'custos') {
      doc.text('Relatório de Custos por Centro', 20, 30);
    } else if (tipo === 'status') {
      doc.text('Relatório de Status das Obras', 20, 30);
    }

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 40);
    doc.text(`Por: ${user.full_name}`, 20, 46);

    let y = 60;

    if (tipo === 'financeiro') {
      // Relatório Financeiro
      doc.setFontSize(12);
      doc.text('Resumo Financeiro por Obra', 20, y);
      y += 10;

      obras.forEach(obra => {
        const orcado = obra.valor_orcado || 0;
        const realizado = contas
          .filter(c => c.obra_id === obra.id && c.tipo === 'pagar' && c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor || 0), 0);
        const faturado = medicoes
          .filter(m => m.obra_id === obra.id && m.status === 'aprovada')
          .reduce((sum, m) => sum + (m.valor_total || 0), 0);

        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.text(obra.nome, 20, y);
        y += 6;
        doc.setFontSize(9);
        doc.text(`Orçado: ${orcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 25, y);
        y += 5;
        doc.text(`Realizado: ${realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 25, y);
        y += 5;
        doc.text(`Faturado: ${faturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 25, y);
        y += 8;
      });
    } else if (tipo === 'status') {
      // Relatório de Status
      doc.setFontSize(12);
      doc.text('Status das Obras Ativas', 20, y);
      y += 10;

      obras.forEach(obra => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.text(`${obra.nome} - ${obra.status}`, 20, y);
        y += 6;
        doc.setFontSize(9);
        doc.text(`Cliente: ${obra.cliente}`, 25, y);
        y += 5;
        doc.text(`Progresso: ${obra.percentual_concluido || 0}%`, 25, y);
        y += 5;
        doc.text(`Valor: ${(obra.valor_contrato || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 25, y);
        y += 8;
      });
    } else if (tipo === 'custos') {
      // Relatório de Custos
      doc.setFontSize(12);
      doc.text('Custos por Centro de Custo', 20, y);
      y += 10;

      const custosPorCentro = {};
      obras.forEach(obra => {
        const centro = obra.centro_custo || 'Não definido';
        if (!custosPorCentro[centro]) {
          custosPorCentro[centro] = { orcado: 0, realizado: 0 };
        }
        custosPorCentro[centro].orcado += obra.valor_orcado || 0;
        const custosObra = contas
          .filter(c => c.obra_id === obra.id && c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor || 0), 0);
        custosPorCentro[centro].realizado += custosObra;
      });

      Object.entries(custosPorCentro).forEach(([centro, dados]) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.text(centro, 20, y);
        y += 6;
        doc.setFontSize(9);
        doc.text(`Orçado: ${dados.orcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 25, y);
        y += 5;
        doc.text(`Realizado: ${dados.realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 25, y);
        y += 8;
      });
    }

    const pdfBytes = doc.output('arraybuffer');
    
    // Converter ArrayBuffer para base64
    const uint8Array = new Uint8Array(pdfBytes);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64String = btoa(binaryString);

    return Response.json({ 
      data: base64String,
      success: true
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});