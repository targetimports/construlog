import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[DRE Global] Iniciando cálculo consolidado da empresa');

    // Buscar todas as obras ativas
    const obras = await base44.asServiceRole.entities.Obra.filter({
      status: { $in: ['ativa', 'em_andamento', 'em andamento'] }
    });

    if (!obras || obras.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhuma obra ativa encontrada',
        total_obras: 0,
        consolidado: {}
      });
    }

    console.log(`[DRE Global] Processando ${obras.length} obras`);

    let receitaContratadaTotal = 0;
    let receitaFaturadaTotal = 0;
    let receitaRecebidaTotal = 0;
    let custoMateriaisTotal = 0;
    let custoMaoObraTotal = 0;
    let custoEquipamentosTotal = 0;
    let custoIndiretasTotal = 0;
    const detalhamentoObras = [];

    // Processar cada obra
    for (const obra of obras) {
      try {
        console.log(`[DRE Global] Calculando DRE da obra ${obra.nome} (${obra.id})`);
        
        // Invocar função de DRE por obra
        const dreResult = await base44.asServiceRole.functions.invoke('calcularDREObra', {
          obra_id: obra.id
        });

        if (dreResult && dreResult.data) {
          const dre = dreResult.data;

          receitaContratadaTotal += dre.receitas?.contratada || 0;
          receitaFaturadaTotal += dre.receitas?.faturada || 0;
          receitaRecebidaTotal += dre.receitas?.recebida || 0;
          custoMateriaisTotal += dre.custos?.materiais || 0;
          custoMaoObraTotal += dre.custos?.mao_obra || 0;
          custoEquipamentosTotal += dre.custos?.equipamentos || 0;
          custoIndiretasTotal += dre.custos?.indiretas || 0;

          detalhamentoObras.push({
            obra_id: obra.id,
            obra_nome: obra.nome,
            receita_faturada: dre.receitas?.faturada || 0,
            custo_total: dre.custos?.total || 0,
            lucro_bruto: dre.indicadores?.lucro_bruto || 0,
            margem_percentual: dre.indicadores?.margem_percentual || 0,
            status: obra.status
          });
        }
      } catch (err) {
        console.error(`[DRE Global] Erro ao processar obra ${obra.nome}:`, err.message);
        detalhamentoObras.push({
          obra_id: obra.id,
          obra_nome: obra.nome,
          erro: err.message
        });
      }
    }

    const custoTotal = custoMateriaisTotal + custoMaoObraTotal + custoEquipamentosTotal + custoIndiretasTotal;
    const lucroBrutoTotal = receitaFaturadaTotal - custoTotal;
    const margemTotal = receitaFaturadaTotal > 0 ? (lucroBrutoTotal / receitaFaturadaTotal) * 100 : 0;

    // Consolidado da empresa
    const consolidado = {
      receitas: {
        contratada: receitaContratadaTotal,
        faturada: receitaFaturadaTotal,
        recebida: receitaRecebidaTotal
      },
      custos: {
        materiais: custoMateriaisTotal,
        mao_obra: custoMaoObraTotal,
        equipamentos: custoEquipamentosTotal,
        indiretas: custoIndiretasTotal,
        total: custoTotal
      },
      indicadores: {
        lucro_bruto: lucroBrutoTotal,
        margem_percentual: parseFloat(margemTotal.toFixed(2)),
        numero_obras: obras.length
      }
    };

    // Ranking de obras por lucro
    const rankingLucro = detalhamentoObras
      .filter(o => !o.erro)
      .sort((a, b) => b.lucro_bruto - a.lucro_bruto)
      .slice(0, 10);

    // Obras com margem crítica
    const obrasCriticas = detalhamentoObras
      .filter(o => !o.erro && o.margem_percentual < 5)
      .sort((a, b) => a.margem_percentual - b.margem_percentual);

    console.log('[DRE Global] Cálculo consolidado concluído');

    return Response.json({
      success: true,
      message: `DRE consolidado calculado para ${obras.length} obras`,
      total_obras: obras.length,
      consolidado,
      detalhamento_obras: detalhamentoObras,
      ranking_lucro: rankingLucro,
      obras_criticas: obrasCriticas,
      data_calculo: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DRE Global] Erro fatal:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});