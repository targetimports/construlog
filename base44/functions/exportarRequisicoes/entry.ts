import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, status_filtro } = await req.json();

    // Buscar requisições
    const requisicoes = await base44.entities.RequisicaoCompra.filter({
      ...(obra_id && { obra_id }),
      ...(status_filtro && { status: status_filtro })
    });

    // Buscar itens das requisições
    const dados = [];
    for (const req_item of requisicoes) {
      const itens = await base44.entities.RequisicaoCompraItem.filter({
        requisicao_compra_id: req_item.id
      });

      for (const item of itens) {
        dados.push({
          'ID Requisição': req_item.id.substring(0, 8),
          'Obra': req_item.obra_id,
          'Status': req_item.status,
          'Data Solicitação': req_item.data_solicitacao,
          'Solicitante': req_item.solicitante_email,
          'Insumo': item.descricao,
          'Quantidade': item.quantidade,
          'Valor Unitário': item.valor_unitario,
          'Valor Total': item.valor_total,
          'Valor Requisição': req_item.valor_total,
          'Aprovado Por': req_item.aprovado_por || '-',
          'Data Aprovação': req_item.data_aprovacao || '-'
        });
      }
    }

    // Criar workbook
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requisições');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Requisicoes_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});