import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orcamento_id } = body;

    if (!orcamento_id) {
      return Response.json({ error: 'orcamento_id é obrigatório' }, { status: 400 });
    }

    // Buscar orçamento
    const orcamento = await base44.entities.Orcamento?.get(orcamento_id);
    if (!orcamento) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    // Buscar itens do orçamento
    const orcamento_itens = await base44.entities.OrcamentoItem?.filter({
      orcamento_id
    }) || [];

    // Buscar composições vinculadas
    const composicoes = await base44.entities.Composicao?.list('', 1000) || [];

    const problemas = {
      itens_sem_insumo: [],
      composicoes_incompletas: [],
      divergencias: [],
      resumo: {}
    };

    // Verificar cada item do orçamento
    for (const item of orcamento_itens) {
      const composicao = composicoes.find(c => c.id === item.composicao_id);

      if (!composicao) {
        problemas.itens_sem_insumo.push({
          item_id: item.id,
          composicao_id: item.composicao_id,
          problema: 'Composição não encontrada'
        });
        continue;
      }

      // Buscar insumos da composição
      const insumos_composicao = await base44.entities.ComposicaoInsumo?.filter({
        composicao_id: item.composicao_id
      }) || [];

      if (insumos_composicao.length === 0) {
        problemas.composicoes_incompletas.push({
          composicao_id: item.composicao_id,
          composicao_codigo: composicao.codigo,
          problema: 'Nenhum insumo vinculado'
        });
      }

      // Verificar se todos os insumos existem no cadastro
      for (const insumo_comp of insumos_composicao) {
        const insumo = await base44.entities.Insumo.get(insumo_comp.insumo_id);
        if (!insumo) {
          problemas.divergencias.push({
            item_id: item.id,
            insumo_id: insumo_comp.insumo_id,
            problema: 'Insumo não encontrado no cadastro'
          });
        }
      }
    }

    problemas.resumo = {
      total_itens: orcamento_itens.length,
      itens_com_problema: problemas.itens_sem_insumo.length + problemas.composicoes_incompletas.length + problemas.divergencias.length,
      status: problemas.itens_sem_insumo.length + problemas.composicoes_incompletas.length + problemas.divergencias.length === 0 ? 'OK' : 'PROBLEMAS'
    };

    return Response.json(problemas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});