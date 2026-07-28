import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, insumo_id } = await req.json();

    if (!obra_id) {
      return Response.json({ 
        error: 'obra_id é obrigatório' 
      }, { status: 400 });
    }

    // Query 1: Saldo de estoque da obra
    const estoqueObra = insumo_id
      ? await base44.entities.EstoqueObra.filter({ obra_id, insumo_id })
      : await base44.entities.EstoqueObra.filter({ obra_id });

    // Query 2: Movimentações apenas desta obra
    const movimentacoes = insumo_id
      ? await base44.entities.MovimentacaoEstoque.filter({ obra_id, insumo_id }, '-data', 50)
      : await base44.entities.MovimentacaoEstoque.filter({ obra_id }, '-data', 100);

    // Query 3: Resumo da obra
    const resumo = {
      obra_id,
      total_itens: estoqueObra.length,
      quantidade_total: estoqueObra.reduce((sum, item) => sum + (item.quantidade_total || 0), 0),
      quantidade_disponivel: estoqueObra.reduce((sum, item) => sum + (item.quantidade_disponivel || 0), 0),
      quantidade_reservada: estoqueObra.reduce((sum, item) => sum + (item.quantidade_reservada || 0), 0),
      valor_total_estoque: estoqueObra.reduce((sum, item) => sum + (item.valor_total_estoque || 0), 0),
      itens_em_alerta: estoqueObra.filter(item => item.status_alerta !== 'ok').length
    };

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'consultarEstoqueObra',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ obra_id, insumo_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        tipo: 'consulta_estoque_obra',
        obra_id,
        itens_retornados: estoqueObra.length,
        movimentacoes: movimentacoes.length
      }
    });

    return Response.json({
      success: true,
      tipo: 'estoque_obra',
      resumo,
      estoque_atual: estoqueObra,
      movimentacoes_recentes: movimentacoes
    });

  } catch (error) {
    console.error('Erro ao consultar estoque da obra:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});