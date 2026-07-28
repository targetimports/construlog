import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_id, tipo = 'analitico' } = await req.json();

    if (!orcamento_id) {
      return Response.json({ error: 'orcamento_id obrigatório' }, { status: 400 });
    }

    // Busca dados
    const orcamento = await base44.asServiceRole.entities.OrcamentoObra.filter({ id: orcamento_id });
    if (!orcamento || orcamento.length === 0) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const itens = await base44.asServiceRole.entities.OrcamentoItem.filter({ 
      orcamento_id 
    });

    // Carrega composições
    const itensComDados = await Promise.all(
      itens.map(async (item) => {
        const comp = item.composicao_snapshot || {};
        return {
          codigo: comp.codigo || '-',
          descricao: comp.descricao || 'Item sem descrição',
          unidade: comp.unidade || '-',
          quantidade: item.quantidade || 0,
          custo_unitario: item.custo_unitario_calculado || 0,
          bdi: item.bdi_aplicado || 0,
          preco_unitario: item.preco_unitario_final || 0,
          custo_total: item.custo_total || 0,
          etapa: item.etapa || '-',
          mes_previsto: item.mes_previsto || 1
        };
      })
    );

    // Cria planilha
    const wb = XLSX.utils.book_new();

    if (tipo === 'analitico') {
      // Planilha analítica
      const wsData = [
        ['ORÇAMENTO ANALÍTICO'],
        [`Orçamento: ${orcamento[0].numero || orcamento[0].id}`],
        [`Data: ${new Date().toLocaleDateString('pt-BR')}`],
        [],
        ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Custo Unit.', 'BDI (%)', 'Preço Unit.', 'Custo Total', 'Etapa', 'Mês'],
        ...itensComDados.map(item => [
          item.codigo,
          item.descricao,
          item.unidade,
          item.quantidade,
          item.custo_unitario,
          item.bdi,
          item.preco_unitario,
          item.custo_total,
          item.etapa,
          item.mes_previsto
        ]),
        [],
        ['', '', '', '', '', '', 'TOTAL:', itensComDados.reduce((sum, i) => sum + i.custo_total, 0)]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Formatação de larguras
      ws['!cols'] = [
        { wch: 12 },
        { wch: 50 },
        { wch: 8 },
        { wch: 12 },
        { wch: 12 },
        { wch: 8 },
        { wch: 12 },
        { wch: 15 },
        { wch: 20 },
        { wch: 8 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Orçamento Analítico');
    } else {
      // Planilha sintética (agrupado por etapa)
      const porEtapa = itensComDados.reduce((acc, item) => {
        const etapa = item.etapa || 'Sem etapa';
        if (!acc[etapa]) {
          acc[etapa] = { etapa, quantidade: 0, custo_total: 0 };
        }
        acc[etapa].quantidade += item.quantidade;
        acc[etapa].custo_total += item.custo_total;
        return acc;
      }, {});

      const wsData = [
        ['ORÇAMENTO SINTÉTICO'],
        [`Orçamento: ${orcamento[0].numero || orcamento[0].id}`],
        [`Data: ${new Date().toLocaleDateString('pt-BR')}`],
        [],
        ['Etapa', 'Custo Total'],
        ...Object.values(porEtapa).map(item => [
          item.etapa,
          item.custo_total
        ]),
        [],
        ['TOTAL:', itensComDados.reduce((sum, i) => sum + i.custo_total, 0)]
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 40 }, { wch: 15 }];

      XLSX.utils.book_append_sheet(wb, ws, 'Orçamento Sintético');
    }

    // Gera arquivo
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=orcamento_${orcamento_id}_${tipo}.xlsx`
      }
    });
  } catch (error) {
    console.error('Erro ao exportar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});