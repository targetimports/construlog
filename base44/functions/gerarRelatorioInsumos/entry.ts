import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tipo_relatorio = 'geral', filtro_base, filtro_grupo } = body;

    const insumos = await base44.entities.Insumo.list('', 500);
    const gruposInsumos = await base44.entities.GrupoInsumo.list('', 50);
    const basesPrecos = await base44.entities.BasePrecosInsumo.list('', 50);

    let insumosRelatorio = insumos;
    if (filtro_base) {
      insumosRelatorio = insumosRelatorio.filter(i => i.base === filtro_base);
    }
    if (filtro_grupo) {
      insumosRelatorio = insumosRelatorio.filter(i => i.grupo === filtro_grupo);
    }

    const relatorio = {
      data_geracao: new Date().toISOString(),
      usuario: user.full_name,
      totais: {
        total_insumos: insumosRelatorio.length,
        insumos_ativos: insumosRelatorio.filter(i => i.ativo).length,
        insumos_inativos: insumosRelatorio.filter(i => !i.ativo).length,
        valor_total_custos: insumosRelatorio.reduce((sum, i) => sum + (i.preco_unitario || 0), 0).toFixed(2)
      },
      resumo_por_grupo: {},
      resumo_por_base: {},
      insumos_detalhados: insumosRelatorio.map(i => ({
        codigo: i.codigo,
        descricao: i.descricao,
        grupo: i.grupo,
        base: i.base,
        unidade: i.unidade,
        custo_unitario: i.preco_unitario,
        status: i.ativo ? 'Ativo' : 'Inativo',
        historico_precos_count: i.historico_precos ? i.historico_precos.length : 0
      }))
    };

    // Resumo por grupo
    gruposInsumos.forEach(grupo => {
      const insumoDoGrupo = insumosRelatorio.filter(i => i.grupo === grupo.codigo);
      relatorio.resumo_por_grupo[grupo.nome] = {
        quantidade: insumoDoGrupo.length,
        valor_total: insumoDoGrupo.reduce((sum, i) => sum + (i.preco_unitario || 0), 0).toFixed(2),
        ativos: insumoDoGrupo.filter(i => i.ativo).length
      };
    });

    // Resumo por base
    basesPrecos.forEach(base => {
      const insumosDaBase = insumosRelatorio.filter(i => i.base === base.tipo);
      relatorio.resumo_por_base[base.nome] = {
        quantidade: insumosDaBase.length,
        valor_total: insumosDaBase.reduce((sum, i) => sum + (i.preco_unitario || 0), 0).toFixed(2)
      };
    });

    return Response.json(relatorio);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});