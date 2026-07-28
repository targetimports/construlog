import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data_inicio, data_fim, obra_id } = await req.json();

    // Buscar todas as contas financeiras
    const todasContas = await base44.asServiceRole.entities.ContaFinanceira.list();
    
    // Filtrar por obra se especificado
    const contas = obra_id 
      ? todasContas.filter(c => c.obra_id === obra_id)
      : todasContas;

    // Separar contas históricas (pagas) e futuras (pendentes)
    const contasPagas = contas.filter(c => c.status === 'pago' && c.data_pagamento);
    const contasPendentes = contas.filter(c => c.status === 'pendente' || c.status === 'atrasado');

    // Calcular dados históricos
    const historicoReceitas = contasPagas
      .filter(c => c.tipo === 'receber')
      .map(c => ({
        valor: c.valor,
        data: c.data_pagamento,
        categoria: c.categoria,
        dias_atraso: Math.ceil((new Date(c.data_pagamento) - new Date(c.data_vencimento)) / (1000 * 60 * 60 * 24))
      }));

    const historicoDespesas = contasPagas
      .filter(c => c.tipo === 'pagar')
      .map(c => ({
        valor: c.valor,
        data: c.data_pagamento,
        categoria: c.categoria,
        dias_atraso: Math.ceil((new Date(c.data_pagamento) - new Date(c.data_vencimento)) / (1000 * 60 * 60 * 24))
      }));

    // Contas futuras
    const receitasFuturas = contasPendentes
      .filter(c => c.tipo === 'receber')
      .map(c => ({
        valor: c.valor,
        vencimento: c.data_vencimento,
        categoria: c.categoria,
        descricao: c.descricao
      }));

    const despesasFuturas = contasPendentes
      .filter(c => c.tipo === 'pagar')
      .map(c => ({
        valor: c.valor,
        vencimento: c.data_vencimento,
        categoria: c.categoria,
        descricao: c.descricao
      }));

    // Calcular médias históricas
    const totalReceitas = historicoReceitas.reduce((sum, r) => sum + r.valor, 0);
    const totalDespesas = historicoDespesas.reduce((sum, d) => sum + d.valor, 0);
    const mediaReceitasMensal = totalReceitas / Math.max(1, historicoReceitas.length);
    const mediaDespesasMensal = totalDespesas / Math.max(1, historicoDespesas.length);

    // Calcular taxa de inadimplência
    const receitasAtrasadas = historicoReceitas.filter(r => r.dias_atraso > 0).length;
    const taxaInadimplencia = historicoReceitas.length > 0 
      ? (receitasAtrasadas / historicoReceitas.length) * 100 
      : 0;

    // Preparar prompt para IA
    const prompt = `Você é um especialista em análise financeira e fluxo de caixa. Analise os dados abaixo e forneça uma previsão detalhada do fluxo de caixa futuro, além de sugestões práticas de otimização.

**DADOS HISTÓRICOS:**
- Total de Receitas Recebidas: R$ ${totalReceitas.toFixed(2)}
- Total de Despesas Pagas: R$ ${totalDespesas.toFixed(2)}
- Média de Receitas Mensal: R$ ${mediaReceitasMensal.toFixed(2)}
- Média de Despesas Mensal: R$ ${mediaDespesasMensal.toFixed(2)}
- Taxa de Inadimplência: ${taxaInadimplencia.toFixed(1)}%

**RECEITAS HISTÓRICAS (amostra):**
${historicoReceitas.slice(0, 10).map(r => 
  `- R$ ${r.valor.toFixed(2)} | ${r.categoria} | Atraso: ${r.dias_atraso} dias`
).join('\n')}

**DESPESAS HISTÓRICAS (amostra):**
${historicoDespesas.slice(0, 10).map(d => 
  `- R$ ${d.valor.toFixed(2)} | ${d.categoria} | Atraso: ${d.dias_atraso} dias`
).join('\n')}

**RECEITAS FUTURAS (A RECEBER):**
Total: R$ ${receitasFuturas.reduce((sum, r) => sum + r.valor, 0).toFixed(2)}
${receitasFuturas.slice(0, 15).map(r => 
  `- R$ ${r.valor.toFixed(2)} | Venc: ${r.vencimento} | ${r.categoria}`
).join('\n')}

**DESPESAS FUTURAS (A PAGAR):**
Total: R$ ${despesasFuturas.reduce((sum, d) => sum + d.valor, 0).toFixed(2)}
${despesasFuturas.slice(0, 15).map(d => 
  `- R$ ${d.valor.toFixed(2)} | Venc: ${d.vencimento} | ${d.categoria}`
).join('\n')}

Forneça uma análise completa e prática.`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          previsao_fluxo_caixa: {
            type: 'object',
            properties: {
              saldo_atual_estimado: { type: 'number' },
              previsao_30_dias: { type: 'number' },
              previsao_60_dias: { type: 'number' },
              previsao_90_dias: { type: 'number' },
              tendencia: { type: 'string' },
              nivel_risco: { type: 'string' }
            }
          },
          analise_detalhada: {
            type: 'object',
            properties: {
              pontos_atencao: { type: 'array', items: { type: 'string' } },
              oportunidades: { type: 'array', items: { type: 'string' } },
              riscos_identificados: { type: 'array', items: { type: 'string' } }
            }
          },
          sugestoes_otimizacao: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                titulo: { type: 'string' },
                descricao: { type: 'string' },
                impacto_estimado: { type: 'string' },
                prioridade: { type: 'string' },
                categoria: { type: 'string' }
              }
            }
          },
          alertas_criticos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mensagem: { type: 'string' },
                gravidade: { type: 'string' },
                acao_recomendada: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      sucesso: true,
      previsao: resultado,
      dados_base: {
        total_receitas_futuras: receitasFuturas.reduce((sum, r) => sum + r.valor, 0),
        total_despesas_futuras: despesasFuturas.reduce((sum, d) => sum + d.valor, 0),
        taxa_inadimplencia: taxaInadimplencia,
        quantidade_contas_pendentes: contasPendentes.length
      }
    });

  } catch (error) {
    console.error('Erro ao prever fluxo de caixa:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});