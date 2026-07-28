import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, etapaObraId, descricao, unidade } = await req.json();

    if (!obraId || !etapaObraId || !descricao) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Buscar planejado da etapa
    const planejamentos = await base44.entities.PlanejamentoInsumoEtapa.filter({
      obra_id: obraId,
      etapa_obra_id: etapaObraId,
      descricao_insumo: descricao
    });

    const quantidadePlanejada = planejamentos.length > 0
      ? planejamentos.reduce((sum, p) => {
          const efetiva = (p.quantidade_ajustada !== null && p.quantidade_ajustada !== undefined)
            ? p.quantidade_ajustada
            : p.quantidade_planejada;
          return sum + efetiva;
        }, 0)
      : 0;

    // 2. Buscar solicitações já aprovadas/entregues (consumido)
    const solicitacoes = await base44.entities.MaterialSolicitado.filter({
      obra_id: obraId,
      etapa_obra_id: etapaObraId,
      descricao: descricao
    });

    const quantidadeConsumida = solicitacoes
      .filter(s => ['aprovado', 'entregue'].includes(s.status))
      .reduce((sum, s) => sum + (s.quantidade || 0), 0);

    return Response.json({
      quantidadePlanejada,
      quantidadeConsumida,
      descricao,
      unidade
    });
  } catch (error) {
    console.error('Erro ao calcular consumo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});