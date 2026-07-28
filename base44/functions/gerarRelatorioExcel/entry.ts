import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { obra_id, tipo } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Buscar dados
    const obra = await base44.entities.Obra.filter({ id: obra_id });
    const medicoes = await base44.entities.Medicao.filter({ obra_id });
    const orcamentos = await base44.entities.Orcamento.filter({ obra_id });
    const itensOrcamento = await base44.entities.ItemOrcamento.list();

    let sheetData = [];
    let fileName = `relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.xlsx`;

    if (tipo === 'progresso' && medicoes.length > 0) {
      sheetData = [
        ['Medição', '% Físico', '% Financeiro', 'Data Início', 'Data Fim']
      ];

      medicoes.forEach(m => {
        const percentualFinanceiro = obra[0]?.valor_orcado 
          ? (m.valor_acumulado / obra[0].valor_orcado * 100) 
          : 0;
        
        sheetData.push([
          m.numero,
          m.percentual_fisico_acumulado || 0,
          percentualFinanceiro.toFixed(2),
          m.periodo_inicio || '',
          m.periodo_fim || ''
        ]);
      });
    } else if (tipo === 'custos' && obra.length > 0) {
      sheetData = [
        ['Categoria', 'Orçado', 'Realizado', 'Variação %']
      ];

      const orcamento = orcamentos[0];
      if (orcamento) {
        const itensCategoria = itensOrcamento.filter(i => i.orcamento_id === orcamento.id);
        const categorias = ['materiais', 'mao_obra', 'equipamentos', 'transporte'];
        
        categorias.forEach(cat => {
          const itens = itensCategoria.filter(i => i.categoria === cat);
          const orcado = itens.reduce((acc, i) => acc + (i.valor_total || 0), 0);
          const realizado = orcado * ((obra[0]?.percentual_concluido || 0) / 100);
          const variacao = orcado > 0 ? ((realizado - orcado) / orcado * 100) : 0;
          
          if (orcado > 0) {
            sheetData.push([
              cat.replace('_', ' '),
              orcado,
              realizado,
              variacao.toFixed(2)
            ]);
          }
        });
      }
    } else if (tipo === 'medicoes' && medicoes.length > 0) {
      sheetData = [
        ['Número', 'Período Início', 'Período Fim', '% Físico', 'Valor Medido', 'Status']
      ];

      medicoes.forEach(m => {
        sheetData.push([
          m.numero,
          m.periodo_inicio || '',
          m.periodo_fim || '',
          m.percentual_fisico_acumulado || 0,
          m.valor_medido || 0,
          m.status || ''
        ]);
      });
    } else {
      // Relatório padrão da obra
      sheetData = [
        ['Campo', 'Valor'],
        ['Nome', obra[0]?.nome || ''],
        ['Cliente', obra[0]?.cliente || ''],
        ['Status', obra[0]?.status || ''],
        ['Progresso %', obra[0]?.percentual_concluido || 0],
        ['Valor Contrato', obra[0]?.valor_contrato || 0],
        ['Valor Orçado', obra[0]?.valor_orcado || 0],
        ['Valor Realizado', obra[0]?.valor_realizado || 0],
        ['Data Início', obra[0]?.data_inicio || ''],
        ['Data Fim Prevista', obra[0]?.data_prevista_fim || '']
      ];
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const uint8Array = new Uint8Array(excelBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${fileName}`
      }
    });
  } catch (error) {
    console.error('Erro ao gerar Excel:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});