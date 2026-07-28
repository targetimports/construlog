import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calcula o status de uma NecessidadeMaterialObra comparando com o estoque.
 * Status: SUFICIENTE | PARCIAL | EM_FALTA | NAO_MAPEADO
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { obra_id, necessidade_id } = await req.json();
    if (!obra_id || !necessidade_id) {
      return Response.json({ error: 'obra_id e necessidade_id obrigatórios' }, { status: 400 });
    }

    // Buscar a necessidade
    const necessidades = await base44.entities.NecessidadeMaterialObra.filter({ id: necessidade_id });
    if (!necessidades || necessidades.length === 0) {
      return Response.json({ error: 'Necessidade não encontrada' }, { status: 404 });
    }

    const nec = necessidades[0];
    const descricao = nec.descricao || `Material #${nec.id.substring(0, 8)}`;

    // Se não tem insumo_id vinculado, status é NAO_MAPEADO
    if (!nec.insumo_id) {
      return Response.json({
        necessidade_id,
        descricao,
        status: 'NAO_MAPEADO',
        quantidade_prevista: nec.quantidade_prevista || 0,
        quantidade_disponivel: 0,
        quantidade_faltante: nec.quantidade_prevista || 0,
        mensagem: 'Material não vinculado a um insumo no sistema'
      });
    }

    // Buscar saldo de estoque para este insumo na obra
    const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({
      insumo_id: nec.insumo_id,
      obra_id: obra_id
    }) || [];

    const saldoTotal = saldos.reduce((sum, s) => sum + (s.quantidade_disponivel || 0), 0);
    const quantidade_prevista = nec.quantidade_prevista || 0;
    const quantidade_faltante = Math.max(0, quantidade_prevista - saldoTotal);
    const ehSuficiente = saldoTotal >= quantidade_prevista;
    const ehParcial = saldoTotal > 0 && saldoTotal < quantidade_prevista;

    let status = 'EM_FALTA';
    if (ehSuficiente) {
      status = 'SUFICIENTE';
    } else if (ehParcial) {
      status = 'PARCIAL';
    }

    return Response.json({
      necessidade_id,
      descricao,
      status,
      quantidade_prevista,
      quantidade_disponivel: saldoTotal,
      quantidade_faltante,
      percentual_disponivel: quantidade_prevista > 0 
        ? Math.round((saldoTotal / quantidade_prevista) * 100) 
        : 0,
      pode_gerar_solicitacao: quantidade_faltante > 0,
      mensagem: status === 'SUFICIENTE' 
        ? 'Material em quantidade suficiente'
        : status === 'PARCIAL'
        ? `Apenas ${Math.round((saldoTotal / quantidade_prevista) * 100)}% disponível`
        : 'Material fora do estoque'
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});