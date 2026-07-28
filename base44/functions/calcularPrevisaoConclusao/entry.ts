import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamentoId, obraId } = await req.json();

    // Buscar orçamento
    const orcamento = await base44.entities.Orcamento.filter({ id: orcamentoId }, null, 1);
    if (orcamento.length === 0) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    // Buscar medições
    const medicoes = await base44.entities.Medicao.filter({ obra_id: obraId }, '-data_envio');

    if (medicoes.length === 0) {
      return Response.json({ error: 'Sem medições registradas' }, { status: 400 });
    }

    // Calcular progressão
    const medicaoMaisRecente = medicoes[0];
    const medicaoPrimeira = medicoes[medicoes.length - 1];

    const dataInicio = new Date(medicaoPrimeira.data_envio);
    const dataFim = new Date(medicaoMaisRecente.data_envio);
    const diasDecorridos = (dataFim - dataInicio) / (1000 * 60 * 60 * 24);

    const percentualConcluido = medicaoMaisRecente.percentual_fisico_acumulado || 0;
    const ritmoPercentualDia = diasDecorridos > 0 ? percentualConcluido / diasDecorridos : 0;

    // Calcular dias restantes
    const percentualRestante = 100 - percentualConcluido;
    const diasRestantesEstimados = ritmoPercentualDia > 0 ? Math.ceil(percentualRestante / ritmoPercentualDia) : 0;

    // Data prevista
    const dataPrevista = new Date();
    dataPrevista.setDate(dataPrevista.getDate() + diasRestantesEstimados);

    // Calcular confiabilidade (mais medições = mais confiável)
    const confiabilidade = Math.min(100, (medicoes.length / 5) * 100);

    // Cenários
    const cenarios = [
      {
        tipo: 'otimista',
        dias_diferenca: Math.ceil(diasRestantesEstimados * 0.7),
        data_termino: new Date(dataPrevista.getTime() - (diasRestantesEstimados * 0.3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        tipo: 'esperado',
        dias_diferenca: diasRestantesEstimados,
        data_termino: dataPrevista.toISOString().split('T')[0]
      },
      {
        tipo: 'pessimista',
        dias_diferenca: Math.ceil(diasRestantesEstimados * 1.3),
        data_termino: new Date(dataPrevista.getTime() + (diasRestantesEstimados * 0.3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    ];

    // Criar registro de previsão
    const previsao = await base44.entities.PrevisaoConclusao.create({
      orcamento_id: orcamentoId,
      obra_id: obraId,
      data_analise: new Date().toISOString(),
      data_termino_planejada: orcamento[0].data_fim_prevista || new Date().toISOString().split('T')[0],
      data_termino_prevista: dataPrevista.toISOString().split('T')[0],
      diferenca_dias: Math.ceil((dataPrevista - new Date(orcamento[0].data_fim_prevista || '2099-12-31')) / (1000 * 60 * 60 * 24)),
      ritmo_percentual_dia: ritmoPercentualDia,
      percentual_concluido: percentualConcluido,
      dias_decorridos: diasDecorridos,
      dias_restantes_estimados: diasRestantesEstimados,
      confiabilidade_previsao: confiabilidade,
      cenarios
    });

    return Response.json({
      success: true,
      previsaoId: previsao.id,
      resumo: {
        percentual_concluido: percentualConcluido,
        data_prevista: dataPrevista.toISOString().split('T')[0],
        dias_restantes: diasRestantesEstimados,
        ritmo_diario: ritmoPercentualDia.toFixed(3),
        confiabilidade: confiabilidade.toFixed(0)
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});