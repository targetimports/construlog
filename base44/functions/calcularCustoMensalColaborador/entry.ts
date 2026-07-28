import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * calcularCustoMensalColaborador - Calcula custo_total_mensal do colaborador
 * Executado no backend para garantir integridade
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { colaborador_id } = await req.json();

    if (!colaborador_id) {
      return Response.json({ error: 'colaborador_id obrigatório' }, { status: 400 });
    }

    // Buscar colaborador
    const colaborador = await base44.entities.Colaborador.get(colaborador_id);

    if (!colaborador) {
      return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    // Buscar benefícios ativos
    const beneficios = await base44.entities.ColaboradorBeneficio.filter(
      { colaborador_id, ativo: true },
      '-created_date',
      100
    ) || [];

    // Buscar custos extras ativos
    const custosExtras = await base44.entities.ColaboradorCustoExtra.filter(
      { colaborador_id, ativo: true },
      '-created_date',
      100
    ) || [];

    // Calcular totais
    const salario = colaborador.remuneracao?.salario_base || 0;
    const bonificacao = colaborador.remuneracao?.bonificacao_valor || 0;

    let fgts = 0;
    if (colaborador.remuneracao?.fgts_tipo === 'percentual') {
      fgts = salario * ((colaborador.remuneracao?.fgts_percentual || 8) / 100);
    } else if (colaborador.remuneracao?.fgts_tipo === 'valor_fixo') {
      fgts = colaborador.remuneracao?.fgts_valor_fixo || 0;
    }

    const totalBeneficios = beneficios.reduce((sum, b) => sum + (b.valor_mensal || 0), 0);
    const totalExtras = custosExtras.reduce((sum, c) => sum + (c.valor_mensal || 0), 0);

    const custoTotalMensal = salario + bonificacao + fgts + totalBeneficios + totalExtras;

    // Atualizar colaborador com novo custo total
    const updated = await base44.entities.Colaborador.update(colaborador_id, {
      remuneracao: {
        ...(colaborador.remuneracao || {}),
        custo_total_mensal: custoTotalMensal,
        data_ultima_atualizacao: new Date().toISOString()
      }
    });

    return Response.json({
      success: true,
      colaborador_id,
      custo_total_mensal: custoTotalMensal,
      detalhes: {
        salario,
        bonificacao,
        fgts,
        beneficios_total: totalBeneficios,
        extras_total: totalExtras
      }
    });
  } catch (error) {
    console.error('[CALC CUSTO]', error);
    return Response.json(
      { error: error.message || 'Erro ao calcular custo' },
      { status: 500 }
    );
  }
});