import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Validar método
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405 });
    }

    // Criar arquivo Excel simples com as colunas esperadas
    const headers = [
      'Etapa',
      'Código',
      'Descrição',
      'Unidade',
      'Quantidade',
      'Custo Unitário',
      'Custo Total',
      'Valor Unitário',
      'Valor Total',
      'Observações'
    ];

    // Criar dados de exemplo
    const exampleData = [
      ['Fundações', 'FUN-001', 'Escavação e movimento de terra', 'm³', 100, 50.00, 5000.00, 75.00, 7500.00, 'Conforme projeto'],
      ['Estrutura', 'EST-001', 'Concreto armado fck=30MPa', 'm³', 80, 400.00, 32000.00, 600.00, 48000.00, 'Concretagem prevista'],
      ['Alvenaria', 'ALV-001', 'Blocos de concreto 14x19x39', 'un', 5000, 2.50, 12500.00, 4.00, 20000.00, 'Material de qualidade'],
      ['Revestimento', 'REV-001', 'Reboco interno', 'm²', 1200, 15.00, 18000.00, 25.00, 30000.00, 'Acabamento padrão'],
      ['Pisos', 'PIS-001', 'Piso cerâmico 60x60', 'm²', 800, 30.00, 24000.00, 50.00, 40000.00, 'Instalação incluída']
    ];

    // Montar CSV com BOM UTF-8 (para Excel ler corretamente)
    let csvContent = headers.join(',') + '\n';
    exampleData.forEach(row => {
      csvContent += row.map(cell => {
        // Escapar valores com vírgula ou aspas
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',') + '\n';
    });

    // Adicionar BOM UTF-8 e converter para Buffer
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csvContent);
    const buffer = new Uint8Array(bom.length + csvBytes.length);
    buffer.set(bom, 0);
    buffer.set(csvBytes, bom.length);

    // Retornar como attachment
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="template-orcamento.csv"',
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Erro ao gerar template:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao gerar template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});