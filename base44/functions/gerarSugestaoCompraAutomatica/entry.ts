import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { almoxarifado_id } = body;

    if (!almoxarifado_id) {
      return Response.json({ error: 'almoxarifado_id obrigatório' }, { status: 400 });
    }

    // 1. Buscar dados do almoxarifado
    const locais = await base44.asServiceRole.entities.LocalEstoque.filter({ id: almoxarifado_id });
    const local = locais?.[0];
    if (!local) return Response.json({ error: 'Almoxarifado não encontrado' }, { status: 404 });

    // 2. Buscar saldos do almoxarifado
    const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter(
      { local_estoque_id: almoxarifado_id }
    );

    // 3. Buscar políticas de estoque do almoxarifado
    const politicas = await base44.asServiceRole.entities.PoliticaEstoque.filter(
      { almoxarifado_id: almoxarifado_id }
    );
    const politicaMap = {};
    for (const p of politicas) {
      const key = p.material_id || p.insumo_id || '';
      if (key) politicaMap[key] = p;
    }

    // 4. Gerar sugestões
    const hoje = new Date();
    const itens = [];

    for (const s of saldos) {
      const materialId = s.material_id;
      if (!materialId) continue;

      const saldoAtual = s.saldo_atual || 0;
      const reservado = s.quantidade_reservada || 0;
      const emTransito = s.quantidade_em_transito || 0;
      const disponivel = Math.max(0, saldoAtual - reservado - emTransito);
      const consumoDiario = s.consumo_medio_diario || 0;
      const custoMedio = s.custo_unitario_medio || 0;

      // Buscar política específica (prioridade: política > saldo > material)
      const pol = politicaMap[materialId] || {};
      
      const pontoReposicao = pol.ponto_reposicao || s.ponto_reposicao || 0;
      const minimo = pol.minimo || s.quantidade_minima || 0;
      const maximo = pol.maximo || 0;
      const leadTime = pol.lead_time_dias || s.lead_time_dias || 0;
      const loteCompra = pol.lote_compra || 1;

      // Calcular dias de cobertura
      const diasCobertura = consumoDiario > 0 ? Math.floor(disponivel / consumoDiario) : 9999;

      // Determinar se precisa comprar
      let motivo = '';
      let precisaComprar = false;

      // Ruptura (saldo zero com mínimo configurado)
      if (saldoAtual === 0 && minimo > 0) {
        motivo = 'RUPTURA — estoque zerado';
        precisaComprar = true;
      }
      // Abaixo do mínimo
      else if (minimo > 0 && disponivel < minimo) {
        motivo = `Abaixo do mínimo (${disponivel.toFixed(1)} < ${minimo})`;
        precisaComprar = true;
      }
      // Atingiu ponto de reposição
      else if (pontoReposicao > 0 && disponivel <= pontoReposicao) {
        motivo = `Ponto de reposição (${disponivel.toFixed(1)} ≤ ${pontoReposicao})`;
        precisaComprar = true;
      }
      // Risco de ruptura durante lead time
      else if (consumoDiario > 0 && leadTime > 0 && diasCobertura <= leadTime) {
        motivo = `Risco ruptura em ${diasCobertura}d (lead time ${leadTime}d)`;
        precisaComprar = true;
      }

      if (!precisaComprar) continue;

      // Calcular quantidade sugerida
      let qtdSugerida = 0;

      if (maximo > 0) {
        // Se tem máximo definido, repor até o máximo
        qtdSugerida = Math.max(0, maximo - saldoAtual + reservado);
      } else if (consumoDiario > 0 && leadTime > 0) {
        // Estoque de segurança = consumo médio × lead time × 1.5
        const estoqueSeguranca = consumoDiario * leadTime * 1.5;
        qtdSugerida = Math.max(0, estoqueSeguranca - disponivel + (minimo || 0));
      } else if (minimo > 0) {
        // Repor até 2x o mínimo
        qtdSugerida = Math.max(0, (minimo * 2) - saldoAtual + reservado);
      } else {
        // Fallback: quantidade mínima razoável
        qtdSugerida = Math.max(pontoReposicao || 1, minimo || 1);
      }

      // Arredondar para lote de compra
      if (loteCompra > 1 && qtdSugerida > 0) {
        qtdSugerida = Math.ceil(qtdSugerida / loteCompra) * loteCompra;
      }

      // Garantir mínimo de 1
      qtdSugerida = Math.max(qtdSugerida, loteCompra || 1);

      itens.push({
        material_id: materialId,
        material_nome: s.material_nome || '',
        unidade: s.material_unidade || '',
        saldo_atual: saldoAtual,
        disponivel,
        reservado,
        consumo_medio_diario: consumoDiario,
        lead_time_dias: leadTime,
        ponto_reposicao: pontoReposicao,
        minimo,
        maximo,
        lote_compra: loteCompra,
        dias_cobertura: diasCobertura === 9999 ? 0 : diasCobertura,
        sugerido: Math.round(qtdSugerida * 100) / 100,
        custo_unitario_medio: custoMedio,
        valor_estimado: Math.round(qtdSugerida * custoMedio * 100) / 100,
        motivo,
        fornecedor_preferencial_id: pol.fornecedor_preferencial_id || '',
        fornecedor_preferencial_nome: pol.fornecedor_preferencial_nome || '',
        selecionado: true
      });
    }

    if (itens.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhum item precisa de reposição neste almoxarifado.',
        sugestao: null 
      });
    }

    // Ordenar por urgência: ruptura > abaixo mínimo > ponto reposição > risco
    itens.sort((a, b) => {
      const pri = (m) => {
        if (m.includes('RUPTURA')) return 0;
        if (m.includes('mínimo')) return 1;
        if (m.includes('reposição')) return 2;
        return 3;
      };
      return pri(a.motivo) - pri(b.motivo);
    });

    const valorTotal = itens.reduce((sum, i) => sum + (i.valor_estimado || 0), 0);

    // Criar registro de sugestão
    const sugestao = await base44.asServiceRole.entities.SugestaoCompra.create({
      almoxarifado_id,
      almoxarifado_nome: local.nome || '',
      empresa_id: local.empresa_id || '',
      periodo_de: new Date(hoje.getTime() - 30 * 86400000).toISOString().split('T')[0],
      periodo_ate: hoje.toISOString().split('T')[0],
      gerado_por: user.email,
      gerado_em: hoje.toISOString(),
      qtd_itens: itens.length,
      valor_total_estimado: Math.round(valorTotal * 100) / 100,
      itens,
      status: 'gerada'
    });

    return Response.json({
      success: true,
      message: `${itens.length} item(ns) identificados para reposição.`,
      sugestao
    });

  } catch (error) {
    console.error('Erro ao gerar sugestão:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});