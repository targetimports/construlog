import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, data_inicio, data_fim, debug_mode } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // 1) PLANEJADO: soma do orçamento (ItemOrcamento via orcamento_id -> obra_id)
    // Buscar orçamentos da obra primeiro
    const orcamentos = await base44.entities.Orcamento.filter({ obra_id });
    const orcamentoIds = orcamentos.map(o => o.id);
    
    // Buscar itens desses orçamentos
    let itensOrcamento = [];
    if (orcamentoIds.length > 0) {
      const allItens = await base44.asServiceRole.entities.ItemOrcamento.list('-created_date', 1000);
      itensOrcamento = allItens.filter(item => orcamentoIds.includes(item.orcamento_id));
    }
    
    const planejado_total = itensOrcamento.reduce((sum, item) => sum + (item.valor_total || 0), 0);

    // 2) REAL MATERIAIS: APENAS movimentações de SAÍDA para obra (não entrada em depósito)
    // Filtrar por obra_destino_id (material indo para obra) e tipo saida_consumo
    let movimentacoes = await base44.entities.MovimentacaoEstoque.filter({
      obra_destino_id: obra_id
    });
    
    // Filtrar apenas saídas para obra (tipos válidos: saida_consumo, saida_transferencia para obra)
    movimentacoes = movimentacoes.filter(m => 
      m.tipo === 'saida_consumo' || 
      (m.tipo === 'saida_transferencia' && m.obra_destino_id === obra_id)
    );
    
    const real_materiais = movimentacoes.reduce((sum, mov) => sum + (mov.valor_total || 0), 0);

    // 3) REAL MÃO DE OBRA: PRIORIDADE ApontamentoHora (se aprovado) + FALLBACK Diário
    let real_mao_obra = 0;
    let total_diarias = 0;
    let labor_source = 'diario_fallback';

    // 3A) TENTAR APONTAMENTO HORA (NOVO)
    try {
      let apontamentos = await base44.entities.ApontamentoHora.filter({
        obra_id,
        status: 'aprovado'
      });

      // Filtrar por período se fornecido
      if (data_inicio && data_fim) {
        apontamentos = apontamentos.filter(ap => {
          const dataAp = new Date(ap.data);
          return dataAp >= new Date(data_inicio) && dataAp <= new Date(data_fim);
        });
      }

      // Se houver apontamentos aprovados, usar eles
      if (apontamentos.length > 0) {
        real_mao_obra = apontamentos.reduce((sum, ap) => sum + (ap.custo_total || 0), 0);
        labor_source = 'apontamento_hora';
        total_diarias = apontamentos.length; // Contar linhas como "dias"
      }
    } catch (e) {
      // ApontamentoHora pode não existir ainda, continuar com fallback
      labor_source = 'diario_fallback';
    }

    // 3B) FALLBACK: Se nenhum apontamento, usar Diário
    if (labor_source === 'diario_fallback' && real_mao_obra === 0) {
      let diarios = await base44.entities.DiarioObra.filter({ obra_id });
      
      // Filtrar por período se fornecido
      if (data_inicio && data_fim) {
        diarios = diarios.filter(d => {
          const dataDiario = new Date(d.data);
          return dataDiario >= new Date(data_inicio) && dataDiario <= new Date(data_fim);
        });
      }
      
      for (const diario of diarios) {
        if (diario.mao_obra && Array.isArray(diario.mao_obra)) {
          for (const mo of diario.mao_obra) {
            const diarias = (mo.quantidade || 0);
            real_mao_obra += diarias * 150; // R$ 150/dia médio
            total_diarias += diarias;
          }
        }
      }
    }

    // 4) REAL FINANCEIRO: contas a pagar PAGAS/PARCIAIS (excluir pendentes)
    // REGRA ANTI-DOUBLE COUNT: apenas contas que NÃO são de material (para evitar contar material 2x)
    let contasPagar = await base44.entities.ContaFinanceira.filter({
      obra_id,
      tipo: 'pagar'
    });
    
    // Filtrar por período se fornecido
    if (data_inicio && data_fim) {
      contasPagar = contasPagar.filter(c => {
        if (!c.data_pagamento) return false;
        const dataPag = new Date(c.data_pagamento);
        return dataPag >= new Date(data_inicio) && dataPag <= new Date(data_fim);
      });
    }
    
    // Filtrar status pago/parcial e excluir categoria "material" (evitar double count)
    const contasPagarValidas = contasPagar.filter(c => 
      (c.status === 'pago' || c.status === 'parcial') &&
      c.categoria !== 'material' // ANTI-DOUBLE COUNT
    );
    
    const real_financeiro = contasPagarValidas.reduce((sum, c) => {
      if (c.status === 'pago') return sum + (c.valor || 0);
      if (c.status === 'parcial') {
        // Para contas a PAGAR parciais, usar valor - (valor - historico baixas)
        const baixado = (c.historico_baixas || []).reduce((s, b) => s + (b.valor || 0), 0);
        return sum + baixado;
      }
      return sum;
    }, 0);

    // 5) RECEITA REALIZADA: contas a receber de medições aprovadas
    // Incluir SOMENTE: origem='medicao' OU valor_recebido > 0
    let contasReceber = await base44.entities.ContaFinanceira.filter({
      obra_id,
      tipo: 'receber'
    });
    
    // Filtrar: aceitar origem=medicao OU se valor_recebido > 0
    contasReceber = contasReceber.filter(c => 
      c.referencia_tipo === 'medicao' || (c.valor_recebido || 0) > 0
    );
    
    // Filtrar por período se fornecido (usar data_pagamento se existir, senão data_vencimento)
    if (data_inicio && data_fim) {
      contasReceber = contasReceber.filter(c => {
        const dataRef = c.data_pagamento || c.data_vencimento;
        if (!dataRef) return false;
        const data = new Date(dataRef);
        return data >= new Date(data_inicio) && data <= new Date(data_fim);
      });
    }
    
    // REGRA: somar APENAS valor_recebido (não valor_total)
    const receita_realizada = contasReceber.reduce((sum, c) => sum + (c.valor_recebido || 0), 0);
    
    // Receita prevista (pendente + saldo parcial)
    const receita_prevista = contasReceber.reduce((sum, c) => {
      return sum + ((c.valor || 0) - (c.valor_recebido || 0));
    }, 0);

    // TOTALIZAÇÕES
    const real_total = real_materiais + real_mao_obra + real_financeiro;
    const margem = receita_realizada - real_total;
    const desvio = real_total - planejado_total;
    const desvio_percentual = planejado_total > 0 ? ((desvio / planejado_total) * 100) : 0;
    const margem_percentual = receita_realizada > 0 ? ((margem / receita_realizada) * 100) : 0;

    const response = {
      obra_id,
      planejado_total,
      real_materiais,
      real_mao_obra,
      real_financeiro,
      real_total,
      receita_realizada,
      receita_prevista,
      receita_total: receita_realizada + receita_prevista,
      margem,
      margem_percentual,
      desvio,
      desvio_percentual,
      labor_source,
      labor_value: real_mao_obra,
      breakdown: {
        planejado: planejado_total,
        real: {
          materiais: real_materiais,
          mao_obra: real_mao_obra,
          financeiro: real_financeiro,
          total: real_total
        },
        receita: {
          realizada: receita_realizada,
          prevista: receita_prevista,
          total: receita_realizada + receita_prevista
        }
      }
    };

    // DEBUG MODE (sempre retornar para auditoria)
    response.debug = {
      planned_source: 'ItemOrcamento.filter({obra_id})',
      real_materials_source: 'MovimentacaoEstoque.filter({obra_destino_id, tipo: saida_consumo/saida_transferencia})',
      real_labor_source: labor_source === 'apontamento_hora' ? 'ApontamentoHora.filter({obra_id, status:aprovado}) -> SUM(custo_total)' : 'DiarioObra.filter({obra_id}) -> mao_obra array * R$150/dia [FALLBACK]',
      labor_source,
      real_finance_source: 'ContaFinanceira.filter({tipo: pagar, status: pago/parcial, categoria != material})',
      revenue_source: 'ContaFinanceira.filter({tipo: receber}) -> valor_recebido',
      counts: {
        itens_orcamento: itensOrcamento.length,
        movimentacoes_materiais: movimentacoes.length,
        total_diarias: total_diarias,
        contas_pagar_validas: contasPagarValidas.length,
        contas_receber: contasReceber.length
      },
      sums: {
        planejado: planejado_total,
        materiais: real_materiais,
        mao_obra: real_mao_obra,
        financeiro: real_financeiro,
        receita_realizada: receita_realizada,
        receita_prevista: receita_prevista
      },
      filters: {
        data_inicio: data_inicio || 'null',
        data_fim: data_fim || 'null',
        periodo_aplicado: !!(data_inicio && data_fim)
      }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Erro ao calcular KPIs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});