import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const periodo = parseInt(searchParams.get('periodo') || '6');

    // Calcular período (últimos N meses)
    const hoje = new Date();
    const dataInicio = new Date();
    dataInicio.setMonth(hoje.getMonth() - periodo);

    // Buscar contas financeiras do período
    const contas = await base44.entities.ContaFinanceira.filter({});

    // Agrupar por mês
    const dadosPorMes = {};

    for (const conta of contas) {
      const dataVencimento = new Date(conta.data_vencimento);
      
      if (dataVencimento >= dataInicio && dataVencimento <= hoje) {
        const mesAno = `${dataVencimento.getFullYear()}-${String(dataVencimento.getMonth() + 1).padStart(2, '0')}`;
        
        if (!dadosPorMes[mesAno]) {
          dadosPorMes[mesAno] = {
            receitas: 0,
            despesas: 0,
            saldo: 0
          };
        }

        if (conta.tipo === 'receber' && conta.status === 'pago') {
          dadosPorMes[mesAno].receitas += conta.valor || 0;
        } else if (conta.tipo === 'pagar' && conta.status === 'pago') {
          dadosPorMes[mesAno].despesas += conta.valor || 0;
        }

        dadosPorMes[mesAno].saldo = dadosPorMes[mesAno].receitas - dadosPorMes[mesAno].despesas;
      }
    }

    // Organizar dados em arrays ordenados
    const mesesOrdenados = Object.keys(dadosPorMes).sort();
    
    const meses = mesesOrdenados.map(mesAno => {
      const [ano, mes] = mesAno.split('-');
      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return mesesNomes[parseInt(mes) - 1];
    });

    const receitas = mesesOrdenados.map(mesAno => dadosPorMes[mesAno].receitas);
    const despesas = mesesOrdenados.map(mesAno => dadosPorMes[mesAno].despesas);
    const saldo = mesesOrdenados.map(mesAno => dadosPorMes[mesAno].saldo);

    return Response.json({
      success: true,
      meses,
      receitas,
      despesas,
      saldo,
      periodo
    });

  } catch (error) {
    console.error('Erro ao obter tendências mensais:', error);
    return Response.json({ 
      error: error.message,
      meses: [],
      receitas: [],
      despesas: [],
      saldo: []
    }, { status: 500 });
  }
});