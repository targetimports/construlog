import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, dataInicio, dataFim } = await req.json();

    // 1. Buscar diários do período
    const diarios = await base44.entities.DiarioObra.filter({
      obra_id: obraId,
      data: { $gte: dataInicio, $lte: dataFim }
    }, 'data');

    // 2. Agregar dados
    const analise = {
      periodo_inicio: dataInicio,
      periodo_fim: dataFim,
      total_diarios: diarios.length,
      dias_trabalhados: diarios.filter(d => d.status === 'finalizado').length,
      dias_rascunho: diarios.filter(d => d.status === 'rascunho').length,
      
      // Mão de obra
      mao_obra_total: 0,
      mao_obra_por_dia: [],
      funcoes_presentes: new Set(),
      
      // Equipamentos
      equipamentos_utilizados: {},
      
      // Ocorrências
      ocorrencias_criticas: [],
      ocorrencias_por_tipo: {},
      
      // Clima
      condicoes_clima: {},
      
      // Atividades
      atividades_realizadas: 0,
      status_atividades: {}
    };

    // 3. Processar cada diário
    diarios.forEach(diario => {
      // Mão de obra
      const mooDia = diario.mao_obra?.reduce((acc, m) => acc + (m.quantidade || 0), 0) || 0;
      analise.mao_obra_total += mooDia;
      analise.mao_obra_por_dia.push({ data: diario.data, quantidade: mooDia });
      
      diario.mao_obra?.forEach(m => {
        analise.funcoes_presentes.add(m.funcao || m.nome);
      });

      // Equipamentos
      diario.equipamentos?.forEach(eq => {
        const chave = eq.descricao;
        analise.equipamentos_utilizados[chave] = (analise.equipamentos_utilizados[chave] || 0) + 1;
      });

      // Ocorrências
      diario.ocorrencias_detalhadas?.forEach(oc => {
        if (oc.gravidade === 'alta' || oc.gravidade === 'critica') {
          analise.ocorrencias_criticas.push({
            data: diario.data,
            tipo: oc.tipo,
            descricao: oc.descricao,
            gravidade: oc.gravidade
          });
        }
        analise.ocorrencias_por_tipo[oc.tipo] = (analise.ocorrencias_por_tipo[oc.tipo] || 0) + 1;
      });

      // Clima
      if (diario.clima) {
        analise.condicoes_clima[diario.clima] = (analise.condicoes_clima[diario.clima] || 0) + 1;
      }

      // Atividades
      analise.atividades_realizadas += diario.atividades?.length || 0;
      diario.atividades?.forEach(at => {
        const status = at.status || 'desconhecido';
        analise.status_atividades[status] = (analise.status_atividades[status] || 0) + 1;
      });
    });

    // 4. Converter Set para Array
    analise.funcoes_presentes = Array.from(analise.funcoes_presentes);

    // 5. Calcular índices
    const indiceProducao = analise.dias_trabalhados > 0 ? 
      (analise.atividades_realizadas / analise.dias_trabalhados).toFixed(2) : 0;
    
    const mediaPoODia = analise.dias_trabalhados > 0 ? 
      (analise.mao_obra_total / analise.dias_trabalhados).toFixed(2) : 0;

    return Response.json({
      sucesso: true,
      analise,
      indices: {
        atividades_por_dia: indiceProducao,
        mao_obra_media_dia: mediaPoODia,
        eficiencia_operacional: diarios.length > 0 ? 
          (analise.dias_trabalhados / diarios.length * 100).toFixed(1) : 0
      },
      avisos: analise.ocorrencias_criticas.length > 0 ? 
        `${analise.ocorrencias_criticas.length} ocorrência(s) crítica(s) no período` : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});