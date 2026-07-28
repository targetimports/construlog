import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tipo, filtros, formato } = await req.json();

    let dados = [];
    if (tipo === 'obras') {
      dados = await base44.entities.Obra.list();
    } else if (tipo === 'medicoes') {
      dados = await base44.entities.Medicao.list();
    } else if (tipo === 'colaboradores') {
      dados = await base44.entities.Colaborador.list();
    }

    // Aplicar filtros
    if (filtros?.status) {
      dados = dados.filter(d => d.status === filtros.status);
    }

    if (formato === 'csv') {
      const csv = converterParaCSV(dados);
      return new Response(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=relatorio.csv' }
      });
    }

    return Response.json({ sucesso: true, dados, total: dados.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function converterParaCSV(dados) {
  if (!dados || dados.length === 0) return '';
  const headers = Object.keys(dados[0]);
  const csv = [
    headers.join(','),
    ...dados.map(d => headers.map(h => `"${d[h] || ''}"`).join(','))
  ].join('\n');
  return csv;
}