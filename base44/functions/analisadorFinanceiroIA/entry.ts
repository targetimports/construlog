import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, mesesProjetados = 12 } = await req.json();

    // Busca dados financeiros históricos
    const contas = await base44.entities.ContaFinanceira.list();
    const obraContas = obraId ? contas.filter(c => c.obra_id === obraId) : contas;

    // Agrupa por mês para análise
    const dadosHistoricos = {};
    obraContas.forEach(c => {
      const data = new Date(c.data_vencimento);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      
      if (!dadosHistoricos[chave]) {
        dadosHistoricos[chave] = { receitas: 0, despesas: 0, pagos: 0 };
      }
      
      if (c.tipo === 'receber') dadosHistoricos[chave].receitas += c.valor || 0;
      if (c.tipo === 'pagar') dadosHistoricos[chave].despesas += c.valor || 0;
      if (c.status === 'pago') dadosHistoricos[chave].pagos += c.valor || 0;
    });

    const resumoHistorico = Object.entries(dadosHistoricos).map(([mes, dados]) => 
      `${mes}: Receitas R$ ${dados.receitas.toFixed(2)}, Despesas R$ ${dados.despesas.toFixed(2)}, Saldo R$ ${(dados.receitas - dados.despesas).toFixed(2)}`
    ).join('\n');

    // Calcula estatísticas
    const valoresReceita = Object.values(dadosHistoricos).map(d => d.receitas);
    const valoresDespesa = Object.values(dadosHistoricos).map(d => d.despesas);
    
    const mediaReceita = valoresReceita.reduce((a, b) => a + b, 0) / valoresReceita.length || 0;
    const mediaDespesa = valoresDespesa.reduce((a, b) => a + b, 0) / valoresDespesa.length || 0;
    const varianciaReceita = valoresReceita.length > 0 ? Math.sqrt(valoresReceita.reduce((a, v) => a + Math.pow(v - mediaReceita, 2), 0) / valoresReceita.length) : 0;

    const prompt = `Você é um analista financeiro especializado em construção civil. 
    
Análise de dados históricos:
${resumoHistorico}

Estatísticas:
- Receita média mensal: R$ ${mediaReceita.toFixed(2)}
- Despesa média mensal: R$ ${mediaDespesa.toFixed(2)}
- Variância de receita: R$ ${varianciaReceita.toFixed(2)}
- Saldo médio mensal: R$ ${(mediaReceita - mediaDespesa).toFixed(2)}

Com base nesses dados, forneça uma análise de previsão financeira para os próximos ${mesesProjetados} meses incluindo:

1. PREVISÃO: Projete receitas, despesas e saldo para cada mês
2. TENDÊNCIAS: Identifique padrões e tendências nos dados
3. RISCOS: Aponte 3-5 riscos financeiros críticos
4. OPORTUNIDADES: Sugira 3-5 oportunidades de otimização
5. ESTRATÉGIAS: Recomende estratégias financeiras específicas
6. ALERTAS: Destaque alertas imediatos para ação

Forneça a resposta em JSON com as seguintes chaves: previsao (array de meses), tendencias (string), riscos (array), oportunidades (array), estrategias (array), alertas (array).`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          previsao: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                mes: { type: 'string' },
                receita: { type: 'number' },
                despesa: { type: 'number' },
                saldo: { type: 'number' }
              }
            }
          },
          tendencias: { type: 'string' },
          riscos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                risco: { type: 'string' },
                severidade: { type: 'string' },
                impacto: { type: 'string' }
              }
            }
          },
          oportunidades: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                oportunidade: { type: 'string' },
                potencial: { type: 'string' },
                acao: { type: 'string' }
              }
            }
          },
          estrategias: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                estrategia: { type: 'string' },
                descricao: { type: 'string' },
                implementacao: { type: 'string' }
              }
            }
          },
          alertas: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    return Response.json({
      success: true,
      analise: resultado,
      periodoAnalisado: Object.keys(dadosHistoricos).length,
      dataAnalise: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});