import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const obra_id = url.searchParams.get('obra_id');
    const contrato_id = url.searchParams.get('contrato_id');
    const status = url.searchParams.get('status');

    const query = {};
    if (obra_id) query.obra_id = obra_id;
    if (contrato_id) query.contrato_id = contrato_id;
    if (status) query.status = status;

    // Buscar todas as medições sem limites de paginação
    let medicoes = await base44.entities.MedicaoContrato.filter(query, '-updated_date', 1000);

    // Gerar CSV
    const headers = ['ID', 'Contrato', 'Obra', 'Fornecedor', 'Número', 'Título', 'Período De', 'Período Até', 'Valor Bruto', 'Retenções', 'Valor Líquido', 'Status', 'Data Aprovação'];
    const rows = medicoes.map(m => [
      m.id,
      m.contrato_id,
      m.obra_id,
      m.fornecedor_id,
      m.numero,
      m.titulo,
      m.periodo_de || '',
      m.periodo_ate || '',
      m.valor_bruto,
      m.retencoes.reduce((sum, r) => sum + (r.valor || 0), 0).toFixed(2),
      m.valor_liquido,
      m.status,
      m.data_aprovacao || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="medicoes_contrato.csv"'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});