import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contratoId, medicaoData } = await req.json();

    // 1. Buscar contrato
    const contratos = await base44.entities.Contrato.filter({ id: contratoId });
    const contrato = contratos[0];

    if (!contrato) {
      return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    // 2. Validações
    const erros = [];
    const avisos = [];

    // Validação 1: Percentual acumulado
    if (medicaoData.percentual_acumulado > 100) {
      erros.push({
        tipo: 'percentual_invalido',
        mensagem: `Percentual acumulado não pode exceder 100% (atual: ${medicaoData.percentual_acumulado}%)`
      });
    }

    // Validação 2: Cronologia
    if (medicaoData.data_medicao < contrato.data_inicio) {
      erros.push({
        tipo: 'data_invalida',
        mensagem: 'Data da medição não pode ser anterior ao início do contrato'
      });
    }

    if (contrato.data_fim && medicaoData.data_medicao > contrato.data_fim) {
      avisos.push({
        tipo: 'data_apos_fim',
        mensagem: 'Data da medição é posterior ao término previsto do contrato'
      });
    }

    // Validação 3: Saldo disponível
    const medicoesAnteriores = await base44.entities.ItemMedicao?.filter?.({
      contrato_id: contratoId,
      status: 'aprovada'
    }) || [];

    const totalMedicaoAnterior = medicoesAnteriores.reduce((acc, m) => acc + (m.valor_total || 0), 0);
    const saldoDisponivel = contrato.valor_total - totalMedicaoAnterior;

    if (medicaoData.valor_total > saldoDisponivel) {
      erros.push({
        tipo: 'saldo_insuficiente',
        mensagem: `Valor da medição (R$ ${medicaoData.valor_total.toFixed(2)}) excede saldo disponível (R$ ${saldoDisponivel.toFixed(2)})`
      });
    }

    // Validação 4: Descontos e Retenções
    const totalDescontos = medicaoData.descontos?.reduce((acc, d) => acc + (d.valor || 0), 0) || 0;
    const totalRetencoes = medicaoData.retencoes?.reduce((acc, r) => acc + (r.valor || 0), 0) || 0;
    const valorLiquido = medicaoData.valor_total - totalDescontos - totalRetencoes;

    if (valorLiquido < 0) {
      erros.push({
        tipo: 'valor_liquido_negativo',
        mensagem: `Valor líquido não pode ser negativo (R$ ${valorLiquido.toFixed(2)})`
      });
    }

    // Validação 5: Retenções dentro dos limites
    const limitesRetencao = {
      'retencao_tecnica': 0.10,
      'inss': 0.08,
      'iss': 0.05,
      'ir': 0.015
    };

    medicaoData.retencoes?.forEach(ret => {
      const limite = limitesRetencao[ret.tipo];
      if (limite && ret.percentual > limite * 100) {
        avisos.push({
          tipo: 'retencao_acima_limite',
          mensagem: `Retenção ${ret.tipo}: ${ret.percentual}% (recomendado até ${limite * 100}%)`
        });
      }
    });

    // 3. Sugestões de correção
    const sugestoes = [];
    if (erros.length > 0) {
      if (erros.some(e => e.tipo === 'saldo_insuficiente')) {
        sugestoes.push('Reduza o valor da medição ou divida em duas parcelas');
      }
      if (erros.some(e => e.tipo === 'valor_liquido_negativo')) {
        sugestoes.push('Ajuste os descontos e retenções para valor positivo');
      }
    }

    return Response.json({
      valido: erros.length === 0,
      erros,
      avisos,
      sugestoes,
      resumo_financeiro: {
        valor_bruto: medicaoData.valor_total,
        total_descontos: totalDescontos,
        total_retencoes: totalRetencoes,
        valor_liquido: valorLiquido,
        percentual_acumulado: medicaoData.percentual_acumulado
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});