import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { obra_id, colaborador_id, equipe_id, status, de, ate, origem } = body;

    // Construir filtro
    const filtro = {};
    if (obra_id) filtro.obra_id = obra_id;
    if (colaborador_id) filtro.colaborador_id = colaborador_id;
    if (equipe_id) filtro.equipe_id = equipe_id;
    if (status) filtro.status = status;
    if (origem) filtro.origem = origem;

    const apontamentos = await base44.asServiceRole.entities.ApontamentoHora.filter(
      filtro,
      '-data',
      10000
    );

    let resultado = apontamentos || [];

    // Filtrar por período
    if (de || ate) {
      resultado = resultado.filter(ap => {
        const data = new Date(ap.data);
        if (de && data < new Date(de)) return false;
        if (ate && data > new Date(ate)) return false;
        return true;
      });
    }

    // Gerar CSV
    const headers = ['Data', 'Colaborador ID', 'Obra ID', 'Horas Normais', 'Horas Extras', 'Custo Hora', 'Custo Total', 'Status', 'Origem', 'Observação'];
    const rows = resultado.map(ap => [
      ap.data,
      ap.colaborador_id,
      ap.obra_id,
      ap.horas_normais,
      ap.horas_extras,
      ap.custo_hora,
      ap.custo_total,
      ap.status,
      ap.origem,
      ap.observacao || ''
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => {
        const str = String(cell || '');
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ).join('\n');

    const base64 = btoa(new TextEncoder().encode(csv).buffer);
    const filename = `apontamentos_horas_${new Date().toISOString().split('T')[0]}.csv`;

    return Response.json({
      ok: true,
      csv_base64: base64,
      filename,
      linhas: resultado.length
    }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});