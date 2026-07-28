import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query params
    const url = new URL(req.url);
    const dataInicio = url.searchParams.get('data_inicio');
    const dataFim = url.searchParams.get('data_fim');
    const veiculo_id = url.searchParams.get('veiculo_id');

    // Buscar movimentações fechadas
    let query = { status: 'FECHADA' };

    // Buscar todas as movimentações e filtrar por data
    const allMovimentacoes = await base44.asServiceRole.entities.MovimentacaoVeiculo.list(
      '-saida_hora',
      10000
    );

    let movimentacoes = allMovimentacoes.filter(
      (m) => m.status === 'FECHADA' && m.km_final && m.km_inicial
    );

    // Filtrar por data
    if (dataInicio && dataFim) {
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      movimentacoes = movimentacoes.filter((m) => {
        const saidaData = new Date(m.saida_hora);
        return saidaData >= inicio && saidaData <= fim;
      });
    }

    // Filtrar por veículo
    if (veiculo_id) {
      movimentacoes = movimentacoes.filter((m) => m.veiculo_id === veiculo_id);
    }

    // Buscar veículos
    const veiculos = await base44.asServiceRole.entities.Veiculo.list('-updated_date', 500);
    const veiculoMap = {};
    veiculos.forEach((v) => {
      veiculoMap[v.id] = v;
    });

    // Agregação por veículo
    const relatorio = {};

    movimentacoes.forEach((mov) => {
      const veiculo_id = mov.veiculo_id;
      if (!relatorio[veiculo_id]) {
        relatorio[veiculo_id] = {
          veiculo_id: veiculo_id,
          placa: veiculoMap[veiculo_id]?.placa || 'N/A',
          modelo: veiculoMap[veiculo_id]?.modelo || 'N/A',
          km_total: 0,
          movimentacoes: 0,
          ultima_saida: null
        };
      }

      const kmRodado = mov.km_final - mov.km_inicial;
      relatorio[veiculo_id].km_total += kmRodado;
      relatorio[veiculo_id].movimentacoes += 1;
      relatorio[veiculo_id].ultima_saida = mov.saida_hora;
    });

    // Converter para array e ordenar
    const relatorioArray = Object.values(relatorio).sort((a, b) => b.km_total - a.km_total);

    return Response.json({
      success: true,
      periodo: {
        data_inicio: dataInicio,
        data_fim: dataFim,
        total_movimentacoes: movimentacoes.length
      },
      veiculos: relatorioArray,
      km_total_geral: relatorioArray.reduce((sum, v) => sum + v.km_total, 0)
    });
  } catch (error) {
    console.error('[relatorioKMVeiculos]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});