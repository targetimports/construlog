import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      obra_id,
      total_geral,
      total_sem_bdi,
      total_bdi,
      bdi_percentual,
      etapas,
      linhas
    } = payload;

    if (!obra_id || !total_geral) {
      return Response.json(
        { error: 'obra_id e total_geral são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se já existe orçamento planejado para esta obra
    const existentes = await base44.entities.OrcamentoPlanejado.filter({
      obra_id
    });

    let orcamentoPlanejado;

    if (existentes.length > 0) {
      // Atualizar existente
      orcamentoPlanejado = existentes[0];
      await base44.entities.OrcamentoPlanejado.update(orcamentoPlanejado.id, {
        total_geral,
        total_sem_bdi,
        total_bdi,
        bdi_percentual,
        estrutura_json: JSON.stringify({
          etapas: etapas || [],
          linhas: linhas || []
        })
      });
    } else {
      // Criar novo
      const criar = await base44.entities.OrcamentoPlanejado.create({
        obra_id,
        total_geral,
        total_sem_bdi,
        total_bdi,
        bdi_percentual,
        estrutura_json: JSON.stringify({
          etapas: etapas || [],
          linhas: linhas || []
        }),
        criado_em: new Date().toISOString()
      });
      orcamentoPlanejado = criar;
    }

    // Deletar etapas antigas (se atualizando)
    const etapasAntigas = await base44.entities.OrcamentoPlanejadoEtapa.filter({
      orcamento_planejado_id: orcamentoPlanejado.id
    });
    
    for (const etapa of etapasAntigas) {
      await base44.entities.OrcamentoPlanejadoEtapa.delete(etapa.id);
    }

    // Criar novas etapas
    const etapasParaCriar = (etapas || []).map(etapa => ({
      obra_id,
      orcamento_planejado_id: orcamentoPlanejado.id,
      nome_etapa: etapa.nome,
      valor_etapa: etapa.valor,
      percentual_etapa: etapa.percentual || 0
    }));

    if (etapasParaCriar.length > 0) {
      await base44.entities.OrcamentoPlanejadoEtapa.bulkCreate(etapasParaCriar);
    }

    return Response.json({
      success: true,
      orcamento_id: orcamentoPlanejado.id,
      message: 'Orçamento planejado salvo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar orçamento planejado:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});