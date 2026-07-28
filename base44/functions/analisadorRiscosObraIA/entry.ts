import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId } = await req.json();

    if (!obraId) {
      return Response.json({ error: 'obraId é obrigatório' }, { status: 400 });
    }

    // Buscar dados da obra
    const obra = await base44.entities.Obra.filter({ id: obraId }).then(r => r[0]);
    const orcamentoItens = await base44.entities.OrcamentoItem.filter({ obra_id: obraId });
    const medicoes = await base44.entities.MedicaoObra.filter({ obra_id: obraId });
    const contratos = await base44.entities.Contrato.filter({ obra_id: obraId });
    const fornecedores = await base44.entities.Fornecedor.list();
    const contas = await base44.entities.ContaFinanceira.filter({ obra_id: obraId });
    const aditivos = await base44.entities.AditivoContrato.filter({ obra_id: obraId });

    // Analisar desvios por item
    const itensComRisco = orcamentoItens.map(item => {
      const medicoesItem = medicoes.filter(m => m.item_orcamento_id === item.id);
      const percentualExecutado = medicoesItem.reduce((sum, m) => sum + (m.percentual_medicao || 0), 0) / Math.max(medicoesItem.length, 1);
      const custo_estimado = item.custo_total || 0;
      const custo_realizado = medicoesItem.reduce((sum, m) => sum + (m.valor_medido || 0), 0);
      const desvio_percentual = custo_realizado > 0 ? ((custo_realizado - custo_estimado) / custo_estimado) * 100 : 0;

      return {
        id: item.id,
        composicao: item.composicao_id,
        percentual_executado: percentualExecutado,
        desvio_percentual,
        custo_estimado,
        custo_realizado,
        risco: Math.abs(desvio_percentual) > 15 ? 'alto' : Math.abs(desvio_percentual) > 5 ? 'médio' : 'baixo'
      };
    }).filter(item => item.risco !== 'baixo');

    // Analisar contratos
    const contratosEmRisco = contratos.map(c => {
      const diasParaVencimento = Math.ceil((new Date(c.data_vencimento) - new Date()) / (1000 * 60 * 60 * 24));
      return {
        id: c.id,
        fornecedor_id: c.fornecedor_id,
        dias_restantes: diasParaVencimento,
        vencimento: c.data_vencimento,
        risco: diasParaVencimento <= 30 ? 'crítico' : diasParaVencimento <= 60 ? 'alto' : 'médio'
      };
    }).filter(c => c.risco !== 'médio' || c.dias_restantes <= 30);

    // Analisar contas atrasadas
    const contasAtrasadas = contas.filter(c => c.status === 'atrasado').length;
    const contasComAtraso = contas.filter(c => {
      const diasAtraso = Math.ceil((new Date() - new Date(c.data_vencimento)) / (1000 * 60 * 60 * 24));
      return diasAtraso > 0 && c.status !== 'pago';
    }).length;

    // Preparar prompt para IA
    const prompt = `Você é um gerente de riscos em projetos de construção civil. Analise os dados abaixo e identifique riscos proativos com ações de mitigação.

OBRA: ${obra?.nome}
- Status: ${obra?.status}
- Progresso: ${obra?.percentual_concluido}%
- Prazos: ${obra?.data_inicio} até ${obra?.data_prevista_fim}

RISCOS TÉCNICOS (Itens com Desvios):
${itensComRisco.slice(0, 5).map(i => 
  `- Item ${i.id}: ${i.risco.toUpperCase()} | Executado ${i.percentual_executado.toFixed(0)}% | Desvio ${i.desvio_percentual > 0 ? '+' : ''}${i.desvio_percentual.toFixed(1)}%`
).join('\n')}
Total de itens em risco: ${itensComRisco.length}

RISCOS DE FORNECEDOR:
${contratosEmRisco.slice(0, 5).map(c => 
  `- Contrato ${c.id}: ${c.risco.toUpperCase()} | ${c.dias_restantes} dias para vencimento`
).join('\n')}
Contas atrasadas: ${contasAtrasadas} | Contas com atraso: ${contasComAtraso}

FORNEÇA UM JSON COM:
1. riscos_identificados: array com cada risco (id, tipo, severidade 1-10, descrição)
2. causas_raiz: array com causas raiz identificadas
3. impactos_potenciais: array com impactos possíveis
4. acoes_mitigacao: array com ações preventivas detalhadas
5. indicadores_alerta: array com KPIs a monitorar
6. prioridade_intervencao: array ordenado de riscos por urgência

Retorne APENAS JSON válido, sem markdown.`;

    const analiseRiscos = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          riscos_identificados: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tipo: { type: 'string' },
                severidade: { type: 'number' },
                descricao: { type: 'string' },
                area_afetada: { type: 'string' }
              }
            }
          },
          causas_raiz: { type: 'array', items: { type: 'string' } },
          impactos_potenciais: { type: 'array', items: { type: 'string' } },
          acoes_mitigacao: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                acao: { type: 'string' },
                responsavel: { type: 'string' },
                prazo: { type: 'string' },
                custo_estimado: { type: 'string' }
              }
            }
          },
          indicadores_alerta: { type: 'array', items: { type: 'string' } },
          prioridade_intervencao: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Salvar análise de riscos
    await base44.entities.Obra.update(obraId, {
      analise_riscos_ia: analiseRiscos,
      data_ultima_analise_riscos: new Date().toISOString()
    });

    return Response.json({
      riscos: analiseRiscos,
      metricas: {
        total_itens_risco: itensComRisco.length,
        total_contratos_risco: contratosEmRisco.length,
        contas_atrasadas: contasAtrasadas,
        contas_com_atraso: contasComAtraso
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});