import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, obraId } = await req.json();

    // Buscar itens do orçamento
    const itens = await base44.entities.ItemOrcamento.filter({
      orcamento_id: orcamentoId
    });

    if (itens.length === 0) {
      return Response.json({ error: 'Nenhum item encontrado' }, { status: 404 });
    }

    // Calcular caminho crítico (Algoritmo simplificado)
    const itensCom Datas = itens.filter(i => i.data_inicio && i.data_fim);
    
    if (itensCom Datas.length === 0) {
      return Response.json({ error: 'Nenhum item com datas preenchidas' }, { status: 400 });
    }

    // Ordenar por data início
    itensCom Datas.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    // Calcular folga e identificar caminho crítico
    const analiseItens = itensCom Datas.map((item, idx) => {
      const duracao = (new Date(item.data_fim) - new Date(item.data_inicio)) / (1000 * 60 * 60 * 24);
      
      // Identificar dependências
      const temPredecessor = item.predecessores && item.predecessores.length > 0;
      const folga = temPredecessor ? 0 : (idx === 0 ? 0 : 0);
      
      return {
        ...item,
        duracao_dias: duracao,
        folga_total: folga,
        nivel_criticidade: folga === 0 ? 'critica' : folga < 5 ? 'alta' : 'media'
      };
    });

    // Calcular duração total
    const dataFimMais Distante = Math.max(...itensCom Datas.map(i => new Date(i.data_fim)));
    const dataInicioMais Proxima = Math.min(...itensCom Datas.map(i => new Date(i.data_inicio)));
    const duracaoTotal = (dataFimMais Distante - dataInicioMais Proxima) / (1000 * 60 * 60 * 24);

    // Identificar pontos de risco
    const pontosRisco = analiseItens
      .filter(item => item.nivel_criticidade === 'critica')
      .map(item => {
        let score = 0;
        let tipo = 'folga_zero';
        let recomendacao = '';

        if (item.folga_total === 0) {
          score = 85;
          recomendacao = 'Aumentar recursos ou revisar escopo para ganhar folga';
        }

        if (item.predecessores && item.predecessores.length > 2) {
          score = Math.max(score, 70);
          tipo = 'dependencias_multiplas';
          recomendacao = 'Múltiplas dependências aumentam risco. Considerar paralelização';
        }

        if (item.duracao_dias > 30) {
          score = Math.max(score, 60);
          tipo = 'duracao_extrema';
          recomendacao = 'Duração muito longa. Dividir em sub-tarefas menores';
        }

        return {
          item_orcamento_id: item.id,
          tipo_risco: tipo,
          score_risco: score,
          recomendacao
        };
      });

    // Simular cenários
    const cenarios = [
      {
        nome_cenario: 'Cenário 1',
        tipo: 'otimista',
        duracao_dias: duracaoTotal * 0.85,
        impacto_financeiro: -50000
      },
      {
        nome_cenario: 'Cenário 2',
        tipo: 'esperado',
        duracao_dias: duracaoTotal,
        impacto_financeiro: 0
      },
      {
        nome_cenario: 'Cenário 3',
        tipo: 'pessimista',
        duracao_dias: duracaoTotal * 1.2,
        impacto_financeiro: 150000
      }
    ];

    // Criar registro de análise
    const analiseRecord = await base44.entities.AnaliseCaminhosCriticos.create({
      orcamento_id: orcamentoId,
      obra_id: obraId,
      data_analise: new Date().toISOString(),
      caminho_critico_identificado: analiseItens
        .filter(item => item.nivel_criticidade === 'critica')
        .map(item => ({
          item_orcamento_id: item.id,
          descricao: item.descricao,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
          duracao_dias: item.duracao_dias,
          folga_total: item.folga_total,
          nivel_criticidade: item.nivel_criticidade
        })),
      duracao_total_projeto: duracaoTotal,
      data_termino_prevista: new Date(dataFimMais Distante).toISOString().split('T')[0],
      pontos_risco: pontosRisco,
      cenarios_simulados: cenarios
    });

    return Response.json({
      success: true,
      analiseId: analiseRecord.id,
      resumo: {
        duracao_total: duracaoTotal,
        itens_criticos: analiseItens.filter(i => i.nivel_criticidade === 'critica').length,
        riscos_identificados: pontosRisco.length,
        cenarios: cenarios
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});