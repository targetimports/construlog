import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { tipo, obra_id, periodo_inicio, periodo_fim } = await req.json();

    // Buscar dados
    let obras = [];
    if (obra_id) {
      obras = await base44.entities.Obra.filter({ id: obra_id });
    } else {
      obras = await base44.entities.Obra.filter({ 
        status: { $in: ['em_andamento', 'a_iniciar', 'orcamento', 'pausada'] } 
      });
    }

    const contas = await base44.entities.ContaFinanceira.list();
    const medicoes = await base44.entities.Medicao.list();

    let csvContent = '';

    if (tipo === 'financeiro') {
      // Cabeçalho CSV
      csvContent = 'Obra,Cliente,Orçado,Realizado,Faturado,Saldo,Desvio %\n';

      obras.forEach(obra => {
        const orcado = obra.valor_orcado || 0;
        const realizado = contas
          .filter(c => c.obra_id === obra.id && c.tipo === 'pagar' && c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor || 0), 0);
        const faturado = medicoes
          .filter(m => m.obra_id === obra.id && m.status === 'aprovada')
          .reduce((sum, m) => sum + (m.valor_total || 0), 0);
        const saldo = orcado - realizado;
        const desvio = orcado > 0 ? ((realizado - orcado) / orcado) * 100 : 0;

        csvContent += `"${obra.nome}","${obra.cliente}",${orcado.toFixed(2)},${realizado.toFixed(2)},${faturado.toFixed(2)},${saldo.toFixed(2)},${desvio.toFixed(2)}\n`;
      });
    } else if (tipo === 'status') {
      // Cabeçalho CSV
      csvContent = 'Obra,Cliente,Status,Progresso %,Valor Contrato,Data Início,Data Fim Prevista\n';

      obras.forEach(obra => {
        const dataInicio = obra.data_inicio || 'Não definido';
        const dataFim = obra.data_prevista_fim || 'Não definido';

        csvContent += `"${obra.nome}","${obra.cliente}","${obra.status}",${obra.percentual_concluido || 0},${(obra.valor_contrato || 0).toFixed(2)},"${dataInicio}","${dataFim}"\n`;
      });
    } else if (tipo === 'custos') {
      // Cabeçalho CSV
      csvContent = 'Centro de Custo,Orçado,Realizado,Desvio %\n';

      const custosPorCentro = {};
      obras.forEach(obra => {
        const centro = obra.centro_custo || 'Não definido';
        if (!custosPorCentro[centro]) {
          custosPorCentro[centro] = { orcado: 0, realizado: 0 };
        }
        custosPorCentro[centro].orcado += obra.valor_orcado || 0;
        const custosObra = contas
          .filter(c => c.obra_id === obra.id && c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor || 0), 0);
        custosPorCentro[centro].realizado += custosObra;
      });

      Object.entries(custosPorCentro).forEach(([centro, dados]) => {
        const desvio = dados.orcado > 0 ? ((dados.realizado - dados.orcado) / dados.orcado) * 100 : 0;
        csvContent += `"${centro}",${dados.orcado.toFixed(2)},${dados.realizado.toFixed(2)},${desvio.toFixed(2)}\n`;
      });
    }

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=relatorio-${tipo}-${new Date().toISOString().split('T')[0]}.csv`
      }
    });
  } catch (error) {
    console.error('Erro ao gerar CSV:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});