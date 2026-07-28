import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { insumo_id, almoxarifado_id } = await req.json();

    // Query 1: Saldo geral por almoxarifado
    const saldoGeral = almoxarifado_id
      ? await base44.entities.SaldoEstoque.filter({ almoxarifado_id, insumo_id })
      : insumo_id
      ? await base44.entities.SaldoEstoque.filter({ insumo_id })
      : await base44.entities.SaldoEstoque.list('-data_ultima_movimentacao', 1000);

    // Query 2: Últimas movimentações
    const movimentacoes = insumo_id
      ? await base44.entities.MovimentacaoEstoque.filter({ insumo_id }, '-data', 50)
      : [];

    // Query 3: Resumo geral
    const resumo = {
      total_itens: saldoGeral.length,
      valor_total_estoque: saldoGeral.reduce((sum, item) => sum + (item.valor_total_estoque || 0), 0),
      quantidade_total: saldoGeral.reduce((sum, item) => sum + (item.quantidade_total || 0), 0),
      itens_alerta: saldoGeral.filter(item => item.quantidade_total < (item.quantidade_minima || 0)).length
    };

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'consultarEstoqueGeral',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ insumo_id, almoxarifado_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'consulta_estoque_geral',
        itens_retornados: saldoGeral.length
      }
    });

    return Response.json({
      success: true,
      tipo: 'estoque_geral',
      resumo,
      saldo_atual: saldoGeral,
      ultimas_movimentacoes: movimentacoes
    });

  } catch (error) {
    console.error('Erro ao consultar estoque geral:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});