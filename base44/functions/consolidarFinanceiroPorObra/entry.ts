import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consolida financeiro por obra: receita, despesa, lucro, folha, logística
 * Agrupa por período (diário/mensal)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, tipo_periodo, periodo } = await req.json();

    if (!obra_id || !tipo_periodo || !periodo) {
      return Response.json({
        error: 'Parâmetros obrigatórios: obra_id, tipo_periodo, periodo'
      }, { status: 400 });
    }

    if (!['diario', 'mensal'].includes(tipo_periodo)) {
      return Response.json({ error: 'tipo_periodo inválido' }, { status: 400 });
    }

    console.log(`[CONSOLIDAÇÃO] Obra: ${obra_id}, Período: ${periodo}, Tipo: ${tipo_periodo}`);

    // Validar acesso à obra
    const acesso = await base44.functions.invoke('validarAcessoObraUsuario', {
      obra_id
    });

    if (!acesso.data.tem_acesso && user.role !== 'admin' && user.role !== 'programador') {
      return Response.json({ error: 'Sem acesso a esta obra' }, { status: 403 });
    }

    // Buscar obra
    const obra = await base44.entities.Obra.filter({ id: obra_id });
    if (obra.length === 0) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    const obraData = obra[0];

    // Determinar range de datas
    let dataInicio, dataFim;
    if (tipo_periodo === 'diario') {
      dataInicio = new Date(`${periodo}T00:00:00Z`);
      dataFim = new Date(`${periodo}T23:59:59Z`);
    } else {
      const [ano, mes] = periodo.split('-');
      dataInicio = new Date(`${ano}-${mes}-01T00:00:00Z`);
      const proximoMes = new Date(dataInicio);
      proximoMes.setMonth(proximoMes.getMonth() + 1);
      dataFim = new Date(proximoMes.getTime() - 1000);
    }

    // RECEITA: Medições aprovadas
    const medicoes = await base44.entities.Medicao.filter({
      obra_id,
      status: 'aprovada'
    });

    const medicoesPeriodo = medicoes.filter(m => {
      const dataMed = new Date(m.updated_date);
      return dataMed >= dataInicio && dataMed <= dataFim;
    });

    const receitaMedicoes = medicoesPeriodo.reduce((sum, m) => sum + (m.valor_total || 0), 0);

    // DESPESA MATERIAL: Notas Fiscais
    const notasFiscais = await base44.entities.NotaFiscal.filter({
      obra_id
    });

    const nfPeriodo = notasFiscais.filter(nf => {
      const dataNf = new Date(nf.updated_date);
      return dataNf >= dataInicio && dataNf <= dataFim;
    });

    const despesaMaterial = nfPeriodo.reduce((sum, nf) => sum + (nf.valor_total || 0), 0);

    // FOLHA: LancamentoFolhaPagamento
    const folha = await base44.entities.LancamentoFolhaPagamento.filter({
      obra_id,
      competencia: tipo_periodo === 'mensal' ? periodo : periodo.substring(0, 7)
    });

    const despesaFolha = folha.reduce((sum, f) => sum + (f.custo_total_mensal || 0), 0);

    // LOGÍSTICA: CustoViagem
    const viagens = await base44.entities.CustoViagem.filter({
      obra_id
    });

    const viagensPeriodo = viagens.filter(v => {
      const dataV = new Date(v.updated_date);
      return dataV >= dataInicio && dataV <= dataFim;
    });

    const despesaLogistica = viagensPeriodo.reduce((sum, v) => sum + (v.valor_total || 0), 0);

    // EQUIPAMENTOS: Uso de equipamento
    const usoEquip = await base44.entities.UsoEquipamento.filter({
      obra_id
    });

    const equipPeriodo = usoEquip.filter(e => {
      const dataE = new Date(e.updated_date);
      return dataE >= dataInicio && dataE <= dataFim;
    });

    const despesaEquipamentos = equipPeriodo.reduce((sum, e) => sum + (e.valor_locacao || e.valor || 0), 0);

    // OUTRAS: Lançamentos Genéricos
    const lancamentos = await base44.entities.LancamentoGenerico.filter({
      obra_id
    });

    const lancPeriodo = lancamentos.filter(l => {
      const dataL = new Date(l.updated_date);
      return dataL >= dataInicio && dataL <= dataFim;
    });

    const despesaOutras = lancPeriodo.reduce((sum, l) => {
      if (l.tipo === 'despesa') return sum + (l.valor || 0);
      return sum;
    }, 0);

    // TOTALIZAÇÕES
    const receitaTotal = receitaMedicoes;
    const despesaTotal = despesaMaterial + despesaFolha + despesaLogistica + despesaEquipamentos + despesaOutras;
    const lucroBruto = receitaTotal - despesaTotal;
    const margemLucro = receitaTotal > 0 ? (lucroBruto / receitaTotal) * 100 : 0;

    // Status da margem
    let margemStatus = 'normal';
    if (margemLucro < 5) margemStatus = 'critica';
    else if (margemLucro < 10) margemStatus = 'alerta';
    else if (margemLucro >= 20) margemStatus = 'excelente';

    // Buscar consolidação anterior (para comparativo)
    let comparativoAnterior = null;
    if (tipo_periodo === 'mensal') {
      const dataPeriodo = new Date(periodo + '-01');
      const mesPrevio = new Date(dataPeriodo);
      mesPrevio.setMonth(mesPrevio.getMonth() - 1);
      const periodoAnterior = mesPrevio.toISOString().substring(0, 7);

      const consAnterior = await base44.entities.ConsolidacaoFinanceiraPorObra.filter({
        obra_id,
        tipo_periodo: 'mensal',
        periodo: periodoAnterior
      });

      if (consAnterior.length > 0) {
        const ca = consAnterior[0];
        comparativoAnterior = {
          receita_variacao: ((receitaTotal - ca.receita_total) / ca.receita_total) * 100,
          despesa_variacao: ((despesaTotal - ca.despesa_total) / ca.despesa_total) * 100,
          lucro_variacao: ((lucroBruto - ca.lucro_bruto) / ca.lucro_bruto) * 100
        };
      }
    }

    // Detalhes
    const detalhes = {
      total_notas_fiscais: nfPeriodo.length,
      total_compras: despesaMaterial,
      colaboradores_ativos: folha.length,
      veiculos_utilizados: viagensPeriodo.length,
      abastecimentos: viagensPeriodo.length,
      km_total: viagensPeriodo.reduce((sum, v) => sum + (v.km || 0), 0)
    };

    // Criar ou atualizar consolidação
    const consolidacaoExistente = await base44.entities.ConsolidacaoFinanceiraPorObra.filter({
      obra_id,
      tipo_periodo,
      periodo
    });

    let resultado;
    if (consolidacaoExistente.length > 0) {
      // Atualizar
      const id = consolidacaoExistente[0].id;
      await base44.entities.ConsolidacaoFinanceiraPorObra.update(id, {
        obra_nome: obraData.nome,
        cidade: obraData.cidade,
        responsavel: obraData.responsavel,
        receita_total: receitaTotal,
        receita_medicoes: receitaMedicoes,
        despesa_total: despesaTotal,
        despesa_material: despesaMaterial,
        despesa_folha_pagamento: despesaFolha,
        despesa_logistica: despesaLogistica,
        despesa_equipamentos: despesaEquipamentos,
        despesa_outras: despesaOutras,
        lucro_bruto: lucroBruto,
        margem_lucro: margemLucro,
        margem_status: margemStatus,
        detalhes_despesas: detalhes,
        comparativo_anterior: comparativoAnterior,
        data_calculo: new Date().toISOString()
      });
      resultado = consolidacaoExistente[0].id;
    } else {
      // Criar
      const novaConsolidacao = await base44.entities.ConsolidacaoFinanceiraPorObra.create({
        obra_id,
        obra_nome: obraData.nome,
        cidade: obraData.cidade,
        responsavel: obraData.responsavel,
        tipo_periodo,
        periodo,
        receita_total: receitaTotal,
        receita_medicoes: receitaMedicoes,
        despesa_total: despesaTotal,
        despesa_material: despesaMaterial,
        despesa_folha_pagamento: despesaFolha,
        despesa_logistica: despesaLogistica,
        despesa_equipamentos: despesaEquipamentos,
        despesa_outras: despesaOutras,
        lucro_bruto: lucroBruto,
        margem_lucro: margemLucro,
        margem_status: margemStatus,
        detalhes_despesas: detalhes,
        comparativo_anterior: comparativoAnterior,
        data_calculo: new Date().toISOString()
      });
      resultado = novaConsolidacao.id;
    }

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'consolidarFinanceiroPorObra',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ obra_id, tipo_periodo, periodo }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        receita_total: receitaTotal,
        despesa_total: despesaTotal,
        lucro: lucroBruto,
        margem: margemLucro.toFixed(2)
      }
    });

    console.log(`[CONSOLIDAÇÃO] Concluída: Receita=${receitaTotal}, Despesa=${despesaTotal}, Lucro=${lucroBruto}`);

    return Response.json({
      success: true,
      consolidacao_id: resultado,
      obra_id,
      periodo,
      tipo_periodo,
      receita_total: receitaTotal,
      receita_medicoes: receitaMedicoes,
      despesa_total: despesaTotal,
      despesa_material: despesaMaterial,
      despesa_folha_pagamento: despesaFolha,
      despesa_logistica: despesaLogistica,
      despesa_equipamentos: despesaEquipamentos,
      despesa_outras: despesaOutras,
      lucro_bruto: lucroBruto,
      margem_lucro: margemLucro.toFixed(2),
      margem_status: margemStatus,
      detalhes_despesas: detalhes,
      comparativo_anterior: comparativoAnterior
    });

  } catch (error) {
    console.error('Erro ao consolidar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});