import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { almoxarifado_id } = await req.json();

    // Buscar saldos
    const saldos = await base44.entities.SaldoEstoque.filter({
      ...(almoxarifado_id && { almoxarifado_id })
    });

    // Preparar dados
    const dados = saldos.map(s => ({
      'Código Insumo': s.codigo_insumo,
      'Descrição': s.descricao_insumo,
      'Unidade': s.unidade,
      'Quantidade Total': s.quantidade_total,
      'Quantidade Reservada': s.quantidade_reservada,
      'Quantidade Disponível': s.quantidade_disponivel,
      'Quantidade Mínima': s.quantidade_minima,
      'Custo Unitário Médio': s.custo_unitario_medio,
      'Valor Total Estoque': s.valor_total_estoque,
      'Última Movimentação': s.data_ultima_movimentacao,
      'Almoxarifado': s.almoxarifado_id
    }));

    // Criar workbook
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Saldos');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Saldos_Estoque_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});