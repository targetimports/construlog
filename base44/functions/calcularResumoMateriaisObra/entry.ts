import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Buscar todas as NecessidadeMaterialObra da obra
    const necessidades = await base44.entities.NecessidadeMaterialObra.filter(
      { obra_id },
      '-created_date',
      1000
    );

    if (!necessidades || necessidades.length === 0) {
      return Response.json({
        total_planejados: 0,
        materiais_ok: 0,
        materiais_em_falta: 0,
        materiais_parcial: 0,
        materiais_nao_mapeados: 0,
        status_geral: 'SEM_MATERIAIS',
        badge: 'Sem materiais',
      });
    }

    // Calcular status de cada necessidade (replicar lógica do backend)
    const contadores = {
      SUFICIENTE: 0,
      PARCIAL: 0,
      EM_FALTA: 0,
      NAO_MAPEADO: 0,
    };

    for (const nec of necessidades) {
      if (!nec.material_id || nec.status === 'NAO_MAPEADO') {
        contadores.NAO_MAPEADO++;
        continue;
      }

      // Buscar estoque
      const estoque = await base44.entities.EstoqueObra.filter(
        {
          obra_id,
          material_id: nec.material_id,
        },
        null,
        1
      );

      const qtd_disponivel = estoque.length > 0 ? (estoque[0].quantidade_disponivel || 0) : 0;
      const qtd_prevista = nec.quantidade_prevista || 0;

      if (qtd_disponivel >= qtd_prevista) {
        contadores.SUFICIENTE++;
      } else if (qtd_disponivel > 0) {
        contadores.PARCIAL++;
      } else {
        contadores.EM_FALTA++;
      }
    }

    // Determinar status geral e badge com regra de prioridade
    let status_geral = 'OK';
    let badge = 'Materiais OK';

    if (contadores.NAO_MAPEADO > 0) {
      status_geral = 'PENDENTE_MAPEAMENTO';
      badge = `${contadores.NAO_MAPEADO} material(is) pendente(s) de mapeamento`;
    } else if (contadores.EM_FALTA > 0 || contadores.PARCIAL > 0) {
      status_geral = 'EM_FALTA';
      const total_falta = contadores.EM_FALTA + contadores.PARCIAL;
      badge = `${total_falta} material(is) em falta`;
    }

    return Response.json({
      total_planejados: necessidades.length,
      materiais_ok: contadores.SUFICIENTE,
      materiais_em_falta: contadores.EM_FALTA,
      materiais_parcial: contadores.PARCIAL,
      materiais_nao_mapeados: contadores.NAO_MAPEADO,
      status_geral,
      badge,
    });
  } catch (error) {
    console.error('Erro em calcularResumoMateriaisObra:', error);
    return Response.json(
      { error: error.message || 'Erro ao calcular resumo' },
      { status: 500 }
    );
  }
});