import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.error('[listarSolicitacoesMaquina] Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const obra_id = url.searchParams.get('obra_id');
    const status = url.searchParams.get('status');

    console.log('[listarSolicitacoesMaquina] Filters:', { obra_id, status });

    let filtro = {};
    if (obra_id) filtro.obra_id = obra_id;
    if (status) filtro.status = status;

    const solicitacoes = await base44.asServiceRole.entities.SolicitacaoMaquina.filter(filtro);
    
    console.log('[listarSolicitacoesMaquina] Found:', solicitacoes.length);

    // Enriquecer com dados da obra
    const solicitacoesEnriquecidas = await Promise.all(
      solicitacoes.map(async (sol) => {
        try {
          const obra = await base44.asServiceRole.entities.Obra.get(sol.obra_id);
          
          // Calcular dias de antecedência atualizados
          const hoje = new Date();
          const dataInicio = new Date(sol.data_inicio);
          const diasAntecedencia = Math.floor((dataInicio - hoje) / (1000 * 60 * 60 * 24));
          
          return {
            ...sol,
            obra_nome: obra?.nome || 'Obra não encontrada',
            dias_antecedencia_atual: diasAntecedencia,
            custo_total: (sol.horas_previstas || 0) * (sol.custo_hora_previsto || 0)
          };
        } catch (err) {
          console.error('[listarSolicitacoesMaquina] Error enriching:', err);
          return sol;
        }
      })
    );

    return Response.json({ 
      ok: true, 
      solicitacoes: solicitacoesEnriquecidas,
      total: solicitacoesEnriquecidas.length 
    });
  } catch (error) {
    console.error('[listarSolicitacoesMaquina] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});