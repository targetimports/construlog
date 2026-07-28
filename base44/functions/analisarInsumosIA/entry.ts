import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { insumos } = await req.json();

    if (!Array.isArray(insumos)) {
      return Response.json({ error: 'Insumos array is required' }, { status: 400 });
    }

    const alertas = [];
    const anomalias = [];

    // Análise 1: Insumos com preço fora do padrão
    insumos.forEach(insumo => {
      if (insumo.preco_unitario > 100000) {
        alertas.push({
          tipo: 'custo_extremo',
          insumo_id: insumo.id,
          codigo: insumo.codigo,
          descricao: insumo.descricao,
          mensagem: `Custo muito alto: R$ ${insumo.preco_unitario.toFixed(2)}`,
          severidade: 'critico'
        });
      }
    });

    // Análise 2: Insumos inativos com base de preço desatualizada
    insumos.filter(i => !i.ativo).forEach(insumo => {
      const hoje = new Date();
      const dataPraco = new Date(insumo.data_preco);
      const diasPassados = Math.floor((hoje - dataPraco) / (1000 * 60 * 60 * 24));

      if (diasPassados > 180) {
        alertas.push({
          tipo: 'preco_desatualizado',
          insumo_id: insumo.id,
          codigo: insumo.codigo,
          descricao: insumo.descricao,
          mensagem: `Preço desatualizado há ${diasPassados} dias`,
          severidade: 'aviso'
        });
      }
    });

    // Análise 3: Discrepâncias entre SINAPI e Base Própria
    const gruposSINAPI = insumos.filter(i => i.base === 'sinapi');
    const gruposPropia = insumos.filter(i => i.base === 'propria');

    gruposSINAPI.forEach(sinapi => {
      const propria = gruposPropia.find(p => 
        p.descricao.toLowerCase().includes(sinapi.descricao.toLowerCase()) ||
        sinapi.descricao.toLowerCase().includes(p.descricao.toLowerCase())
      );

      if (propria) {
        const diferenca = Math.abs(sinapi.preco_unitario - propria.preco_unitario);
        const percentual = (diferenca / sinapi.preco_unitario) * 100;

        if (percentual > 30) {
          anomalias.push({
            tipo: 'divergencia_bases',
            insumo_sinapi: sinapi.codigo,
            insumo_propria: propria.codigo,
            diferenca_percentual: percentual.toFixed(2),
            mensagem: `Diferença de ${percentual.toFixed(2)}% entre bases`,
            severidade: percentual > 50 ? 'critico' : 'aviso'
          });
        }
      }
    });

    // Análise 4: Sugerir otimizações
    const dicas = [];
    
    if (gruposPropia.length > 0) {
      const mediaPropia = gruposPropia.reduce((a, i) => a + (i.preco_unitario || 0), 0) / gruposPropia.length;
      const piorCusto = gruposPropia.reduce((prev, curr) => 
        (curr.preco_unitario || 0) > (prev.preco_unitario || 0) ? curr : prev
      );

      dicas.push({
        tipo: 'otimizacao',
        recomendacao: `Revisar custo de ${piorCusto.descricao} - R$ ${piorCusto.preco_unitario?.toFixed(2)} vs média de R$ ${mediaPropia.toFixed(2)}`
      });
    }

    return Response.json({
      status: 'sucesso',
      alertas: alertas,
      anomalias: anomalias,
      dicas: dicas,
      resumo: {
        total_alertas: alertas.length,
        total_anomalias: anomalias.length,
        insumos_analisados: insumos.length
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});