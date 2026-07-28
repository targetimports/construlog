import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consolida dados do Financeiro Operacional por período
 * Retorna totais por grupo, obra e geral
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { periodo_de, periodo_ate, obra_id = null } = await req.json();

    if (!periodo_de || !periodo_ate) {
      return Response.json({ 
        error: 'periodo_de e periodo_ate são obrigatórios (YYYY-MM-DD)' 
      }, { status: 400 });
    }

    console.log('[Consolidação Financeira] Calculando:', { periodo_de, periodo_ate, obra_id });

    const startDate = new Date(periodo_de);
    const endDate = new Date(periodo_ate);

    // Helper para filtrar por período
    const dentroPerio = (data) => {
      const d = new Date(data);
      return d >= startDate && d <= endDate;
    };

    // Buscar todas as contas
    const contas = await base44.asServiceRole.entities.ContaFinanceira.list();

    // ========== ENTRADAS (Receitas) ==========
    const entradas = contas.filter(c =>
      c.tipo === 'receber' &&
      (c.status === 'pago' || c.status === 'recebido' || c.status === 'parcial') &&
      c.status !== 'cancelado' &&
      c.data_pagamento &&
      dentroPerio(c.data_pagamento) &&
      (!obra_id || c.obra_id === obra_id)
    );

    const totalEntradas = entradas.reduce((sum, c) => {
      const valorRecebido = parseFloat(c.valor_recebido || c.valor_pago || c.valor) || 0;
      return sum + valorRecebido;
    }, 0);

    // ========== SAÍDAS (Custos por grupo) ==========
    const saidas = contas.filter(c =>
      c.tipo === 'pagar' &&
      (c.status === 'pago' || c.status === 'parcial') &&
      c.status !== 'cancelado' &&
      c.data_pagamento &&
      dentroPerio(c.data_pagamento) &&
      (!obra_id || c.obra_id === obra_id)
    );

    const saidasPorGrupo = {
      material: 0,
      mao_de_obra: 0,
      fretes: 0,
      impostos: 0,
      alimentacao: 0,
      aluguel: 0,
      estadias: 0,
      investimento: 0,
      outros: 0
    };

    saidas.forEach(c => {
      const valorPago = parseFloat(c.valor_pago || c.valor) || 0;
      const categoria = (c.categoria || '').toLowerCase();

      if (categoria.includes('material') || categoria.includes('insumo')) {
        saidasPorGrupo.material += valorPago;
      } else if (categoria.includes('mao') || categoria.includes('mão') || categoria.includes('servico') || categoria.includes('serviço')) {
        saidasPorGrupo.mao_de_obra += valorPago;
      } else if (categoria.includes('frete') || categoria.includes('transporte') || categoria.includes('logistica')) {
        saidasPorGrupo.fretes += valorPago;
      } else if (categoria.includes('imposto') || categoria.includes('tributo') || categoria.includes('taxa')) {
        saidasPorGrupo.impostos += valorPago;
      } else if (categoria.includes('alimenta')) {
        saidasPorGrupo.alimentacao += valorPago;
      } else if (categoria.includes('aluguel') || categoria.includes('combust')) {
        saidasPorGrupo.aluguel += valorPago;
      } else if (categoria.includes('estadia') || categoria.includes('hospedagem')) {
        saidasPorGrupo.estadias += valorPago;
      } else if (categoria.includes('investimento') || categoria.includes('capex')) {
        saidasPorGrupo.investimento += valorPago;
      } else {
        saidasPorGrupo.outros += valorPago;
      }
    });

    // ========== ESTOQUE (Saídas de consumo) ==========
    try {
      const movEstoque = await base44.asServiceRole.entities.MovimentacaoEstoque.filter({
        tipo: 'saida_consumo',
        ...(obra_id ? { obra_id } : {})
      });

      const saidasEstoque = movEstoque.filter(m =>
        m.data &&
        dentroPerio(m.data) &&
        m.status !== 'cancelado'
      );

      const custoEstoque = saidasEstoque.reduce((sum, m) => {
        const valorUnit = parseFloat(m.valor_unitario) || 0;
        const qtd = parseFloat(m.quantidade) || 0;
        return sum + (valorUnit * qtd);
      }, 0);

      saidasPorGrupo.material += custoEstoque;
    } catch (e) {
      console.log('[Consolidação] MovimentacaoEstoque não disponível:', e.message);
    }

    const totalSaidas = Object.values(saidasPorGrupo).reduce((sum, v) => sum + v, 0);

    // ========== TOTAIS POR OBRA ==========
    const obrasUnicas = [...new Set(contas.filter(c => c.obra_id).map(c => c.obra_id))];
    const totaisPorObra = {};

    for (const oId of obrasUnicas) {
      const entradasObra = entradas.filter(c => c.obra_id === oId).reduce((s, c) => s + (parseFloat(c.valor_recebido || c.valor) || 0), 0);
      const saidasObra = saidas.filter(c => c.obra_id === oId).reduce((s, c) => s + (parseFloat(c.valor_pago || c.valor) || 0), 0);

      totaisPorObra[oId] = {
        entradas: entradasObra,
        saidas: saidasObra,
        saldo: entradasObra - saidasObra
      };
    }

    // ========== CONTAGENS ==========
    const contagens = {
      total_contas_receber: entradas.length,
      total_contas_pagar: saidas.length,
      obras_com_movimento: obrasUnicas.length
    };

    console.log('[Consolidação Financeira] Concluída:', {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas
    });

    return Response.json({
      success: true,
      periodo: { de: periodo_de, ate: periodo_ate },
      obra_id: obra_id || null,
      entradas: {
        total: parseFloat(totalEntradas.toFixed(2)),
        detalhes: entradas.map(c => ({
          id: c.id,
          descricao: c.descricao,
          valor_recebido: parseFloat(c.valor_recebido || c.valor) || 0,
          data_pagamento: c.data_pagamento,
          obra_id: c.obra_id
        }))
      },
      saidas: {
        total: parseFloat(totalSaidas.toFixed(2)),
        por_grupo: {
          material: parseFloat(saidasPorGrupo.material.toFixed(2)),
          mao_de_obra: parseFloat(saidasPorGrupo.mao_de_obra.toFixed(2)),
          fretes: parseFloat(saidasPorGrupo.fretes.toFixed(2)),
          impostos: parseFloat(saidasPorGrupo.impostos.toFixed(2)),
          alimentacao: parseFloat(saidasPorGrupo.alimentacao.toFixed(2)),
          aluguel: parseFloat(saidasPorGrupo.aluguel.toFixed(2)),
          estadias: parseFloat(saidasPorGrupo.estadias.toFixed(2)),
          investimento: parseFloat(saidasPorGrupo.investimento.toFixed(2)),
          outros: parseFloat(saidasPorGrupo.outros.toFixed(2))
        }
      },
      totais_por_obra: totaisPorObra,
      contagens,
      saldo_periodo: parseFloat((totalEntradas - totalSaidas).toFixed(2))
    });

  } catch (error) {
    console.error('[Consolidação Financeira] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});