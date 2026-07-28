import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const {
      obra_id,
      aumento_material_percentual = 0,
      aumento_mao_obra_percentual = 0,
      aumento_consumo_percentual = 0,
      atraso_cronograma_dias = 0
    } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // Buscar DRE atual
    const dreAtual = await base44.asServiceRole.entities.DREObra.filter({
      obra_id
    });

    let dre = {};
    if (dreAtual && dreAtual.length > 0) {
      dre = dreAtual[0];
    } else {
      // Se não existir, calcular
      const calc = await base44.functions.invoke('calcularDREObra', { obra_id });
      if (calc.status === 200) {
        const dadosDre = JSON.parse(calc.body);
        dre = dadosDre.indicadores;
      }
    }

    // ============ SIMULAÇÃO ============

    // Custo simulado de materiais
    const custoMateriaisSimulado = dre.custo_materiais * (1 + aumento_material_percentual / 100);
    const impactoMaterial = custoMateriaisSimulado - (dre.custo_materiais || 0);

    // Custo simulado de mão de obra
    const custoMaoObraSimulado = dre.custo_mao_obra * (1 + aumento_mao_obra_percentual / 100);
    const impactoMaoObra = custoMaoObraSimulado - (dre.custo_mao_obra || 0);

    // Consumo simulado (assume distribuição proporcional)
    const custoTotalSimulado = (custoMateriaisSimulado + custoMaoObraSimulado + (dre.custo_equipamentos || 0) + (dre.custo_despesas_indiretas || 0));

    // Atraso no cronograma afeta receita (spread proporcional)
    const impactoAtraso = atraso_cronograma_dias > 0 ? (dre.receita_faturada || 0) * 0.001 * atraso_cronograma_dias : 0;
    const receitaSimulada = (dre.receita_faturada || 0) - impactoAtraso;

    // Lucro simulado
    const lucroSimulado = receitaSimulada - custoTotalSimulado;
    const margemSimulada = receitaSimulada > 0 ? (lucroSimulado / receitaSimulada) * 100 : 0;

    // Impactos
    const impactoTotal = lucroSimulado - (dre.lucro_bruto || 0);
    const impactoPercentual = (dre.lucro_bruto || 0) > 0 ? (impactoTotal / (dre.lucro_bruto || 0)) * 100 : 0;

    // Cenários críticos
    const cenariosCriticos = [];
    if (margemSimulada < 0) {
      cenariosCriticos.push('Prejuízo: margem negativa');
    }
    if (Math.abs(impactoPercentual) > 20) {
      cenariosCriticos.push(`Impacto severo: ${impactoPercentual.toFixed(1)}% de queda de lucro`);
    }

    return Response.json({
      obra_id,
      parametros_simulados: {
        aumento_material_percentual,
        aumento_mao_obra_percentual,
        aumento_consumo_percentual,
        atraso_cronograma_dias
      },
      cenario_atual: {
        receita_faturada: dre.receita_faturada || 0,
        custo_total: dre.custo_total || 0,
        lucro_bruto: dre.lucro_bruto || 0,
        margem_percentual: dre.margem_percentual || 0
      },
      cenario_simulado: {
        receita_faturada: receitaSimulada,
        custo_materiais: custoMateriaisSimulado,
        custo_mao_obra: custoMaoObraSimulado,
        custo_total: custoTotalSimulado,
        lucro_bruto: lucroSimulado,
        margem_percentual: margemSimulada
      },
      impactos: {
        material: impactoMaterial,
        mao_obra: impactoMaoObra,
        atraso_cronograma: impactoAtraso,
        total_lucro: impactoTotal,
        total_percentual: impactoPercentual
      },
      cenarios_criticos: cenariosCriticos
    });

  } catch (error) {
    console.error('Erro na simulação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});