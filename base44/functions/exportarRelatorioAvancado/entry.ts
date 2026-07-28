import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';
import autoTable from 'npm:jspdf-autotable@3.8.4';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo, formato, obras: obraIds, materiais: materialIds } = await req.json();

    // Buscar dados
    const obras = await base44.asServiceRole.entities.Obra.list();
    const materiais = await base44.asServiceRole.entities.Material.list();
    const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.list();
    const requisicoes = await base44.asServiceRole.entities.RequisicaoCompra.list();
    const ordens = await base44.asServiceRole.entities.OrdemCompra.list();

    if (formato === 'pdf') {
      return gerarPDF(tipo, { obras, materiais, movimentacoes, requisicoes, ordens });
    } else if (formato === 'xlsx') {
      return gerarExcel(tipo, { obras, materiais, movimentacoes, requisicoes, ordens });
    }

    return Response.json({ error: 'Formato não suportado' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao exportar relatório:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function gerarPDF(tipo, dados) {
  const doc = new jsPDF();
  
  // Cabeçalho
  doc.setFontSize(20);
  doc.text('Relatório Avançado', 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

  if (tipo === 'custos-obra') {
    gerarPDFCustosObra(doc, dados);
  } else if (tipo === 'custos-material') {
    gerarPDFCustosMaterial(doc, dados);
  } else if (tipo === 'dashboard-compras') {
    gerarPDFDashboardCompras(doc, dados);
  }

  const pdfBytes = doc.output('arraybuffer');
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=relatorio_${tipo}_${new Date().toISOString().split('T')[0]}.pdf`
    }
  });
}

function gerarPDFCustosObra(doc, dados) {
  const { obras, movimentacoes, requisicoes } = dados;

  const dadosTabela = obras.map(obra => {
    const movObra = movimentacoes.filter(m => m.obra_destino_id === obra.id || m.obra_origem_id === obra.id);
    const reqObra = requisicoes.filter(r => r.obra_id === obra.id);
    
    const custoMov = movObra.reduce((s, m) => s + (m.valor_total || 0), 0);
    const custoReq = reqObra.reduce((s, r) => s + (r.valor_total_estimado || 0), 0);
    const total = custoMov + custoReq;

    return [
      obra.nome,
      obra.status || '-',
      `R$ ${custoMov.toLocaleString('pt-BR')}`,
      `R$ ${custoReq.toLocaleString('pt-BR')}`,
      `R$ ${total.toLocaleString('pt-BR')}`
    ];
  });

  autoTable(doc, {
    startY: 35,
    head: [['Obra', 'Status', 'Movimentações', 'Requisições', 'Total']],
    body: dadosTabela,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }
  });
}

function gerarPDFCustosMaterial(doc, dados) {
  const { materiais, movimentacoes } = dados;

  const dadosTabela = materiais.map(material => {
    const movMaterial = movimentacoes.filter(m => m.material_id === material.id);
    const custoTotal = movMaterial.reduce((s, m) => s + (m.valor_total || 0), 0);
    const qtdTotal = movMaterial.reduce((s, m) => {
      if (m.tipo === 'entrada') return s + (m.quantidade || 0);
      if (m.tipo === 'saida') return s - (m.quantidade || 0);
      return s;
    }, 0);

    return [
      material.codigo || '-',
      material.nome,
      material.categoria || '-',
      `${Math.abs(qtdTotal).toLocaleString('pt-BR')} ${material.unidade}`,
      `R$ ${custoTotal.toLocaleString('pt-BR')}`
    ];
  });

  autoTable(doc, {
    startY: 35,
    head: [['Código', 'Material', 'Categoria', 'Quantidade', 'Custo Total']],
    body: dadosTabela,
    theme: 'grid',
    headStyles: { fillColor: [139, 92, 246] }
  });
}

function gerarPDFDashboardCompras(doc, dados) {
  const { requisicoes, ordens } = dados;

  // Status das requisições
  doc.setFontSize(14);
  doc.text('Status das Requisições', 14, 40);

  const statusData = [
    ['Aguardando', requisicoes.filter(r => r.status === 'aguardando').length],
    ['Em Cotação', requisicoes.filter(r => r.status === 'em_cotacao').length],
    ['Aprovada', requisicoes.filter(r => r.status === 'aprovada').length],
    ['Em Compra', requisicoes.filter(r => r.status === 'em_compra').length],
    ['Recebida', requisicoes.filter(r => r.status === 'recebida').length]
  ];

  autoTable(doc, {
    startY: 45,
    head: [['Status', 'Quantidade']],
    body: statusData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }
  });

  // Análise de economia
  const valorEstimado = requisicoes.reduce((s, r) => s + (r.valor_total_estimado || 0), 0);
  const valorReal = ordens.reduce((s, o) => s + (o.valor_total || 0), 0);
  const economia = valorEstimado - valorReal;

  doc.setFontSize(14);
  doc.text('Análise de Economia', 14, doc.lastAutoTable.finalY + 15);
  
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Métrica', 'Valor']],
    body: [
      ['Valor Estimado', `R$ ${valorEstimado.toLocaleString('pt-BR')}`],
      ['Valor Real', `R$ ${valorReal.toLocaleString('pt-BR')}`],
      ['Economia', `R$ ${economia.toLocaleString('pt-BR')}`],
      ['% Economia', `${valorEstimado > 0 ? ((economia / valorEstimado) * 100).toFixed(1) : 0}%`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] }
  });
}

function gerarExcel(tipo, dados) {
  const workbook = XLSX.utils.book_new();

  if (tipo === 'custos-obra') {
    gerarExcelCustosObra(workbook, dados);
  } else if (tipo === 'custos-material') {
    gerarExcelCustosMaterial(workbook, dados);
  } else if (tipo === 'dashboard-compras') {
    gerarExcelDashboardCompras(workbook, dados);
  }

  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=relatorio_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`
    }
  });
}

function gerarExcelCustosObra(workbook, dados) {
  const { obras, movimentacoes, requisicoes } = dados;

  const dadosSheet = obras.map(obra => {
    const movObra = movimentacoes.filter(m => m.obra_destino_id === obra.id || m.obra_origem_id === obra.id);
    const reqObra = requisicoes.filter(r => r.obra_id === obra.id);
    
    const custoMov = movObra.reduce((s, m) => s + (m.valor_total || 0), 0);
    const custoReq = reqObra.reduce((s, r) => s + (r.valor_total_estimado || 0), 0);
    const total = custoMov + custoReq;

    return {
      'Obra': obra.nome,
      'Status': obra.status || '-',
      'Custo Movimentações': custoMov,
      'Custo Requisições': custoReq,
      'Custo Total': total,
      'Orçamento': obra.valor_orcado || 0,
      '% Gasto': obra.valor_orcado > 0 ? ((total / obra.valor_orcado) * 100).toFixed(1) : 0
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dadosSheet);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Custos por Obra');
}

function gerarExcelCustosMaterial(workbook, dados) {
  const { materiais, movimentacoes } = dados;

  const dadosSheet = materiais.map(material => {
    const movMaterial = movimentacoes.filter(m => m.material_id === material.id);
    const custoTotal = movMaterial.reduce((s, m) => s + (m.valor_total || 0), 0);
    const qtdTotal = movMaterial.reduce((s, m) => {
      if (m.tipo === 'entrada') return s + (m.quantidade || 0);
      if (m.tipo === 'saida') return s - (m.quantidade || 0);
      return s;
    }, 0);

    return {
      'Código': material.codigo || '-',
      'Material': material.nome,
      'Categoria': material.categoria || '-',
      'Unidade': material.unidade,
      'Quantidade': Math.abs(qtdTotal),
      'Preço Médio': qtdTotal > 0 ? custoTotal / qtdTotal : 0,
      'Custo Total': custoTotal
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dadosSheet);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Custos por Material');
}

function gerarExcelDashboardCompras(workbook, dados) {
  const { requisicoes, ordens, obras } = dados;

  // Sheet 1: Status das Requisições
  const statusSheet = [
    { 'Status': 'Aguardando', 'Quantidade': requisicoes.filter(r => r.status === 'aguardando').length },
    { 'Status': 'Em Cotação', 'Quantidade': requisicoes.filter(r => r.status === 'em_cotacao').length },
    { 'Status': 'Aprovada', 'Quantidade': requisicoes.filter(r => r.status === 'aprovada').length },
    { 'Status': 'Em Compra', 'Quantidade': requisicoes.filter(r => r.status === 'em_compra').length },
    { 'Status': 'Recebida', 'Quantidade': requisicoes.filter(r => r.status === 'recebida').length }
  ];
  const ws1 = XLSX.utils.json_to_sheet(statusSheet);
  XLSX.utils.book_append_sheet(workbook, ws1, 'Status Requisições');

  // Sheet 2: Performance por Obra
  const perfSheet = obras.map(obra => {
    const reqObra = requisicoes.filter(r => r.obra_id === obra.id);
    const ordObra = ordens.filter(o => o.obra_id === obra.id);
    const valorTotal = ordObra.reduce((s, o) => s + (o.valor_total || 0), 0);

    return {
      'Obra': obra.nome,
      'Requisições': reqObra.length,
      'Ordens': ordObra.length,
      'Valor Total': valorTotal,
      'Ticket Médio': ordObra.length > 0 ? valorTotal / ordObra.length : 0
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(perfSheet);
  XLSX.utils.book_append_sheet(workbook, ws2, 'Performance por Obra');
}