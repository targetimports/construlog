import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, status_filtro } = await req.json();

    // Buscar demandas
    const demandas = await base44.entities.DemandaEstoqueObra.filter({
      ...(obra_id && { obra_id }),
      ...(status_filtro && { status: status_filtro })
    });

    // Preparar dados para Excel
    const dados = demandas.map(d => ({
      'ID': d.id.substring(0, 8),
      'Obra': d.obra_id,
      'Insumo': d.descricao_insumo,
      'Código Insumo': d.insumo_id,
      'Quantidade': d.quantidade_necessaria,
      'Unidade': d.unidade,
      'Valor Unitário': d.valor_unitario,
      'Valor Total': d.valor_total,
      'Status': d.status,
      'Data Criação': d.data_criacao,
      'Requisição ID': d.requisicao_id || '-'
    }));

    // Criar workbook e worksheet
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Demandas');

    // Escrever arquivo
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Demandas_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});