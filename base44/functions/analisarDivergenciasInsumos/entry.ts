import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todos os insumos
    const insumos = await base44.entities.Insumo.list('', 1000);

    // Buscar composições (para análise do orçamento)
    const composicoes = await base44.entities.Composicao?.list('', 1000) || [];

    // Buscar composições_insumo (vínculo entre composição e insumo)
    const composicoes_insumo = await base44.entities.ComposicaoInsumo?.list('', 1000) || [];

    // Buscar materiais antigos (estoque)
    const materiais_antigos = await base44.entities.Material?.list('', 1000) || [];

    // Buscar saldos de estoque
    const saldos = await base44.entities.SaldoEstoque?.list('', 1000) || [];

    // Buscar vínculos existentes
    const vinculos_existentes = await base44.entities.VinculacaoOrcamentoEstoque?.list('', 1000) || [];

    const divergencias = {
      insumos_sem_vinculo_estoque: [],
      materiais_sem_insumo: [],
      composicoes_sem_insumo: [],
      sugestoes_vinculacao: [],
      resumo: {}
    };

    // 1. Insumos que existem mas não estão vinculados a materiais de estoque
    for (const insumo of insumos) {
      const tem_saldo = saldos.some(s => s.insumo_id === insumo.id);
      const tem_vinculo = vinculos_existentes.some(v => v.insumo_id === insumo.id && v.status === 'confirmado');

      if (!tem_saldo && !tem_vinculo) {
        divergencias.insumos_sem_vinculo_estoque.push({
          insumo_id: insumo.id,
          codigo: insumo.codigo,
          descricao: insumo.descricao,
          grupo: insumo.grupo,
          unidade: insumo.unidade
        });
      }
    }

    // 2. Materiais antigos do estoque que poderiam ser vinculados
    for (const material of materiais_antigos) {
      const tem_vinculo = vinculos_existentes.some(
        v => v.material_estoque_id === material.id && v.status === 'confirmado'
      );

      if (!tem_vinculo) {
        // Procurar sugestão de vinculação
        const sugestoes = insumos
          .map(insumo => {
            const nome_match = insumo.descricao.toLowerCase() === material.nome.toLowerCase() ? 100 : 0;
            const unidade_match = insumo.unidade === material.unidade ? 20 : 0;
            const categoria_match = insumo.grupo === material.categoria ? 30 : 0;

            const confianca = nome_match + unidade_match + categoria_match;

            return {
              insumo_id: insumo.id,
              insumo_codigo: insumo.codigo,
              insumo_descricao: insumo.descricao,
              confianca,
              motivos_match: [
                nome_match > 0 ? 'nome exato' : null,
                unidade_match > 0 ? 'unidade compatível' : null,
                categoria_match > 0 ? 'grupo compatível' : null
              ].filter(m => m)
            };
          })
          .filter(s => s.confianca > 0)
          .sort((a, b) => b.confianca - a.confianca);

        divergencias.materiais_sem_insumo.push({
          material_id: material.id,
          codigo: material.codigo,
          nome: material.nome,
          categoria: material.categoria,
          unidade: material.unidade,
          estoque_atual: material.estoque_atual,
          sugestoes_vinculacao: sugestoes.slice(0, 3)
        });
      }
    }

    // 3. Composições sem insumos vinculados
    for (const composicao of composicoes) {
      const insumos_da_composicao = composicoes_insumo.filter(ci => ci.composicao_id === composicao.id);

      if (insumos_da_composicao.length === 0) {
        divergencias.composicoes_sem_insumo.push({
          composicao_id: composicao.id,
          codigo: composicao.codigo,
          descricao: composicao.descricao
        });
      }
    }

    // Calcular resumo
    divergencias.resumo = {
      total_insumos: insumos.length,
      total_materiais_antigos: materiais_antigos.length,
      total_composicoes: composicoes.length,
      insumos_desvinculados: divergencias.insumos_sem_vinculo_estoque.length,
      materiais_desvinculados: divergencias.materiais_sem_insumo.length,
      composicoes_vazias: divergencias.composicoes_sem_insumo.length,
      vinculos_confirmados: vinculos_existentes.filter(v => v.status === 'confirmado').length,
      vinculos_propostos: vinculos_existentes.filter(v => v.status === 'proposto').length
    };

    return Response.json(divergencias);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});