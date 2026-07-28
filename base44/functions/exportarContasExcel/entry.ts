import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Buscar contas da obra
    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({ obra_id });

    // Preparar dados para Excel
    const dadosExcel = contas.map(conta => ({
      'Tipo': conta.tipo === 'pagar' ? 'A Pagar' : 'A Receber',
      'Descrição': conta.descricao,
      'Valor (R$)': conta.valor,
      'Data Vencimento': conta.data_vencimento,
      'Data Pagamento': conta.data_pagamento || '',
      'Status': conta.status,
      'Categoria': conta.categoria,
      'Fornecedor/Cliente': conta.fornecedor_cliente || '',
      'Nota Fiscal': conta.nota_fiscal || '',
      'Observação': conta.observacao || ''
    }));

    // Criar workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosExcel);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 12 }, // Tipo
      { wch: 40 }, // Descrição
      { wch: 15 }, // Valor
      { wch: 15 }, // Data Vencimento
      { wch: 15 }, // Data Pagamento
      { wch: 12 }, // Status
      { wch: 15 }, // Categoria
      { wch: 30 }, // Fornecedor/Cliente
      { wch: 15 }, // Nota Fiscal
      { wch: 40 }  // Observação
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');

    // Gerar arquivo Excel
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Retornar como base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(excelBuffer)));

    return Response.json({
      success: true,
      file: base64,
      filename: `Pagamentos-${new Date().toISOString().split('T')[0]}.xlsx`,
      total_contas: contas.length
    });

  } catch (error) {
    console.error('Erro ao exportar contas:', error);
    return Response.json({ 
      error: 'Erro ao exportar planilha',
      details: error.message 
    }, { status: 500 });
  }
});