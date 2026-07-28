import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consolidação financeira COMPLETA por obra: realizado vs previsto
 * Sem N+1, sem duplicação, com filtros de permissão
 * Retorna: receita (realizada/prevista), despesa (realizada/prevista), saldo, breakdown
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      obra_id, 
      data_inicio,
      data_fim,
      tipo = 'AMBOS', // REALIZADO | PREVISTO | AMBOS
      filtro_categoria_id,
      filtro_fornecedor_id,
      filtro_centro_custo_id
    } = await req.json();

    if (!obra_id || !data_inicio || !data_fim) {
      return Response.json({
        error: 'Parâmetros obrigatórios: obra_id, data_inicio, data_fim'
      }, { status: 400 });
    }

    // VALIDAÇÃO DE ACESSO
    const acesso = await base44.functions.invoke('validarAcessoObraUsuario', {
      obra_id
    });

    if (!acesso.data.tem_acesso && user.role !== 'admin' && user.role !== 'programador') {
      return Response.json({ error: 'Sem acesso a esta obra' }, { status: 403 });
    }

    const dataInicio = new Date(`${data_inicio}T00:00:00Z`);
    const dataFim = new Date(`${data_fim}T23:59:59Z`);

    console.log(`[CONSOLIDAÇÃO] Obra: ${obra_id}, Período: ${data_inicio} a ${data_fim}, Tipo: ${tipo}`);

    // === RECEITA REALIZADA: ContasReceber paga ===
    let receitaRealizada = 0;
    if (['REALIZADO', 'AMBOS'].includes(tipo)) {
      const contasReceber = await base44.entities.ContaFinanceira.filter({
        obra_id,
        tipo: 'receita',
        status: 'pago'
      });

      receitaRealizada = contasReceber
        .filter(cr => {
          const data = new Date(cr.data_pagamento || cr.updated_date);
          return data >= dataInicio && data <= dataFim;
        })
        .reduce((sum, cr) => sum + (cr.valor || 0), 0);
    }

    // === RECEITA PREVISTA: ContasReceber aberta ===
    let receitaPrevista = 0;
    if (['PREVISTO', 'AMBOS'].includes(tipo)) {
      const contasReceber = await base44.entities.ContaFinanceira.filter({
        obra_id,
        tipo: 'receita',
        status: 'pendente'
      });

      receitaPrevista = contasReceber
        .filter(cr => {
          const data = new Date(cr.data_vencimento || cr.updated_date);
          return data >= dataInicio && data <= dataFim;
        })
        .reduce((sum, cr) => sum + (cr.valor || 0), 0);
    }

    // === DESPESA REALIZADA: ContasPagar paga ===
    let despesaRealizada = 0;
    if (['REALIZADO', 'AMBOS'].includes(tipo)) {
      const contasPagar = await base44.entities.ContaFinanceira.filter({
        obra_id,
        tipo: 'despesa',
        status: 'pago'
      });

      despesaRealizada = contasPagar
        .filter(cp => {
          const data = new Date(cp.data_pagamento || cp.updated_date);
          return data >= dataInicio && data <= dataFim;
        })
        .reduce((sum, cp) => sum + (cp.valor || 0), 0);
    }

    // === DESPESA PREVISTA: ContasPagar aberta ===
    let despesaPrevista = 0;
    if (['PREVISTO', 'AMBOS'].includes(tipo)) {
      const contasPagar = await base44.entities.ContaFinanceira.filter({
        obra_id,
        tipo: 'despesa',
        status: 'pendente'
      });

      despesaPrevista = contasPagar
        .filter(cp => {
          const data = new Date(cp.data_vencimento || cp.updated_date);
          return data >= dataInicio && data <= dataFim;
        })
        .reduce((sum, cp) => sum + (cp.valor || 0), 0);
    }

    // === BREAKDOWN DE DESPESAS (realizada + prevista) ===
    const todasDespesas = await base44.entities.ContaFinanceira.filter({
      obra_id,
      tipo: 'despesa'
    });

    const despesasFiltradas = todasDespesas.filter(d => {
      const data = new Date(d.data_pagamento || d.data_vencimento || d.updated_date);
      if (data < dataInicio || data > dataFim) return false;
      if (filtro_categoria_id && d.categoria_id !== filtro_categoria_id) return false;
      return true;
    });

    const despesaPorCategoria = {};
    despesasFiltradas.forEach(d => {
      const cat = d.categoria || 'Outra';
      despesaPorCategoria[cat] = (despesaPorCategoria[cat] || 0) + (d.valor || 0);
    });

    // === TOP FORNECEDORES (realizada + prevista) ===
    const fornecedorMap = {};
    despesasFiltradas.forEach(d => {
      if (d.fornecedor_id) {
        const key = d.fornecedor_id;
        fornecedorMap[key] = {
          fornecedor_id: d.fornecedor_id,
          fornecedor_nome: d.fornecedor_nome || 'N/A',
          valor: (fornecedorMap[key]?.valor || 0) + (d.valor || 0)
        };
      }
    });

    const topFornecedores = Object.values(fornecedorMap)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    // === TOP CENTROS DE CUSTO ===
    const cCustoMap = {};
    despesasFiltradas.forEach(d => {
      if (d.centro_custo_id) {
        const key = d.centro_custo_id;
        cCustoMap[key] = {
          centro_custo_id: d.centro_custo_id,
          centro_custo_nome: d.centro_custo_nome || 'N/A',
          valor: (cCustoMap[key]?.valor || 0) + (d.valor || 0)
        };
      }
    });

    const topCentroCusto = Object.values(cCustoMap)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    // === CAIXA DIÁRIO ===
    const caixaDiario = {};
    const allTransactions = [
      ...todasDespesas.map(d => ({
        data: d.data_pagamento || d.data_vencimento || d.updated_date,
        tipo: 'saida',
        valor: d.valor || 0
      }))
    ];

    const todasReceitas = await base44.entities.ContaFinanceira.filter({
      obra_id,
      tipo: 'receita'
    });

    allTransactions.push(...todasReceitas.map(r => ({
      data: r.data_pagamento || r.data_vencimento || r.updated_date,
      tipo: 'entrada',
      valor: r.valor || 0
    })));

    allTransactions.forEach(t => {
      const data = t.data.substring(0, 10);
      if (!caixaDiario[data]) {
        caixaDiario[data] = { data, entrada: 0, saida: 0, saldo: 0 };
      }
      if (t.tipo === 'entrada') {
        caixaDiario[data].entrada += t.valor;
      } else {
        caixaDiario[data].saida += t.valor;
      }
    });

    // Calcular saldo cumulativo
    let saldoAcumulado = 0;
    Object.keys(caixaDiario).sort().forEach(data => {
      caixaDiario[data].saldo = saldoAcumulado + caixaDiario[data].entrada - caixaDiario[data].saida;
      saldoAcumulado = caixaDiario[data].saldo;
    });

    // === TOTALIZAÇÕES ===
    const receitaTotal = receitaRealizada + receitaPrevista;
    const despesaTotal = despesaRealizada + despesaPrevista;
    const saldoRealizado = receitaRealizada - despesaRealizada;
    const saldoPrevisto = receitaPrevista - despesaPrevista;
    const margemRealizada = receitaRealizada > 0 ? ((saldoRealizado / receitaRealizada) * 100) : 0;

    // Definir status de margem
    let margemStatus = 'normal';
    if (margemRealizada < 5) margemStatus = 'critica';
    else if (margemRealizada < 10) margemStatus = 'alerta';
    else if (margemRealizada >= 20) margemStatus = 'excelente';

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'consolidarFinanceiroCompleto',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ obra_id, data_inicio, data_fim, tipo }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        receita_realizada: receitaRealizada,
        receita_prevista: receitaPrevista,
        despesa_realizada: despesaRealizada,
        despesa_prevista: despesaPrevista,
        saldo: saldoRealizado
      }
    });

    console.log(`[CONSOLIDAÇÃO] Sucesso: Receita=${receitaTotal}, Despesa=${despesaTotal}, Saldo=${saldoRealizado}`);

    return Response.json({
      success: true,
      obra_id,
      data_inicio,
      data_fim,
      receita_realizada: receitaRealizada,
      receita_prevista: receitaPrevista,
      receita_total: receitaTotal,
      despesa_realizada: despesaRealizada,
      despesa_prevista: despesaPrevista,
      despesa_total: despesaTotal,
      saldo_realizado: saldoRealizado,
      saldo_previsto: saldoPrevisto,
      saldo_total: saldoRealizado + saldoPrevisto,
      margem_realizada: margemRealizada.toFixed(2),
      margem_status: margemStatus,
      despesa_por_categoria: despesaPorCategoria,
      top_fornecedores: topFornecedores,
      top_centros_custo: topCentroCusto,
      caixa_diario: Object.values(caixaDiario).sort((a, b) => a.data.localeCompare(b.data))
    });

  } catch (error) {
    console.error('Erro ao consolidar:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});