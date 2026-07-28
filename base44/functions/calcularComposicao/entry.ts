import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { composicao_id } = await req.json();

    // Buscar insumos da composição
    const relacoes = await base44.entities.ComposicaoInsumo.filter({
      composicao_id
    });

    let custoTotal = 0;

    // Calcular custo de cada insumo
    for (const rel of relacoes) {
      const insumos = await base44.entities.Insumo.filter({ id: rel.insumo_id });
      
      if (insumos.length > 0) {
        const insumo = insumos[0];
        const custoParcial = rel.coeficiente * insumo.preco_unitario;
        
        // Atualizar custo parcial
        await base44.asServiceRole.entities.ComposicaoInsumo.update(rel.id, {
          custo_parcial: custoParcial
        });

        custoTotal += custoParcial;
      }
    }

    // Atualizar composição
    await base44.asServiceRole.entities.Composicao.update(composicao_id, {
      custo_unitario: custoTotal,
      ultima_atualizacao: new Date().toISOString(),
      atualizado_por: user.email
    });

    return Response.json({
      custo_unitario: custoTotal,
      total_insumos: relacoes.length
    });

  } catch (error) {
    console.error('Erro no cálculo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});