import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { formato, obraIds = [], filtros = {} } = await req.json();

    // Buscar dados das obras
    const obras = obraIds.length > 0 
      ? await Promise.all(obraIds.map(id => base44.entities.Obra.get(id)))
      : [];

    if (formato === 'csv') {
      return gerarCSV(obras);
    } else if (formato === 'pdf') {
      return gerarPDF(obras);
    }

    return Response.json({ error: 'Formato inválido' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function gerarCSV(obras) {
  const headers = [
    'Nome da Obra',
    'Cliente',
    'Código',
    'Fase',
    'Status',
    'Endereço',
    'Orçamento Total',
    'BDI %',
    'Total Final',
    'Área (m²)',
    'Data Início',
    'Data Fim Prevista'
  ];

  const rows = obras.map(obra => [
    obra.nome || '',
    obra.cliente || '',
    obra.codigo || '',
    obra.fase || '',
    obra.status || '',
    obra.endereco || '',
    (obra.total_orcamento || 0).toString(),
    (obra.bdi_percent || 0).toString(),
    (obra.total_final_orcamento || 0).toString(),
    (obra.area_total || '').toString(),
    obra.data_inicio || '',
    obra.data_prevista_fim || ''
  ]);

  let csv = headers.map(h => `"${h}"`).join(',') + '\n';
  csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  const blob = new TextEncoder().encode(csv);
  
  return new Response(blob, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio-obras.csv"'
    }
  });
}

function gerarPDF(obras) {
  // Gerar HTML para PDF
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #4361EE; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .status { padding: 4px 8px; border-radius: 4px; display: inline-block; }
        .status.ativa { background-color: #d1fae5; color: #065f46; }
        .status.concluida { background-color: #dbeafe; color: #1e40af; }
        .status.pausada { background-color: #fed7aa; color: #92400e; }
      </style>
    </head>
    <body>
      <h1>Relatório de Obras</h1>
      <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
      <p>Total de obras: ${obras.length}</p>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cliente</th>
            <th>Fase</th>
            <th>Status</th>
            <th>Orçamento</th>
            <th>Endereço</th>
            <th>Início</th>
          </tr>
        </thead>
        <tbody>
  `;

  obras.forEach(obra => {
    const statusClass = obra.status === 'em_andamento' ? 'ativa' : 
                       obra.status === 'concluida' ? 'concluida' :
                       obra.status === 'pausada' ? 'pausada' : '';
    
    html += `
      <tr>
        <td>${obra.nome || ''}</td>
        <td>${obra.cliente || ''}</td>
        <td>${obra.fase || ''}</td>
        <td><span class="status ${statusClass}">${obra.status || ''}</span></td>
        <td>R$ ${(obra.total_final_orcamento || 0).toLocaleString('pt-BR')}</td>
        <td>${obra.endereco || ''}</td>
        <td>${obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : ''}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new TextEncoder().encode(html);
  
  return new Response(blob, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio-obras.html"'
    }
  });
}