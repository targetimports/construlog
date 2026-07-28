import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraId, dataInicio, dataFim, status } = await req.json();

    // 1. Buscar diários
    const diarios = await base44.entities.DiarioObra?.filter?.({
      obra_id: obraId,
      status: status || 'finalizado'
    }) || [];

    const diariosFiltragem = diarios.filter(d => {
      const data = new Date(d.data);
      return data >= new Date(dataInicio) && data <= new Date(dataFim);
    });

    // 2. Estatísticas
    const stats = {
      total_diarios: diariosFiltragem.length,
      total_atividades: 0,
      total_ocorrencias: 0,
      total_arquivos: 0,
      clima_distribuicao: {},
      condicoes_trabalho: {},
      mao_obra_utilizacao: {},
      equipamentos_utilizacao: {},
      ocorrencias_tipos: {}
    };

    // 3. Processar dados
    for (const diario of diariosFiltragem) {
      // Atividades
      stats.total_atividades += diario.atividades?.length || 0;

      // Ocorrências
      stats.total_ocorrencias += diario.ocorrencias_detalhadas?.length || 0;

      // Arquivos
      stats.total_arquivos += diario.fotos?.length || 0;

      // Clima
      if (diario.clima) {
        stats.clima_distribuicao[diario.clima] = (stats.clima_distribuicao[diario.clima] || 0) + 1;
      }

      // Condições de trabalho
      if (diario.condicoes_climaticas?.condicao_trabalho) {
        const cond = diario.condicoes_climaticas.condicao_trabalho;
        stats.condicoes_trabalho[cond] = (stats.condicoes_trabalho[cond] || 0) + 1;
      }

      // Mão de obra
      if (diario.mao_obra) {
        for (const mo of diario.mao_obra) {
          const chave = mo.nome || 'N/A';
          stats.mao_obra_utilizacao[chave] = (stats.mao_obra_utilizacao[chave] || 0) + (mo.quantidade || 1);
        }
      }

      // Equipamentos
      if (diario.equipamentos) {
        for (const eq of diario.equipamentos) {
          const chave = eq.descricao || 'N/A';
          stats.equipamentos_utilizacao[chave] = (stats.equipamentos_utilizacao[chave] || 0) + (eq.horas_uso || 0);
        }
      }

      // Ocorrências tipos
      if (diario.ocorrencias_detalhadas) {
        for (const oc of diario.ocorrencias_detalhadas) {
          stats.ocorrencias_tipos[oc.tipo] = (stats.ocorrencias_tipos[oc.tipo] || 0) + 1;
        }
      }
    }

    // 4. Formatar para gráficos
    const graficos = {
      clima: Object.entries(stats.clima_distribuicao).map(([tipo, quantidade]) => ({
        nome: tipo,
        valor: quantidade
      })),
      condicoes: Object.entries(stats.condicoes_trabalho).map(([tipo, quantidade]) => ({
        nome: tipo,
        valor: quantidade
      })),
      mao_obra: Object.entries(stats.mao_obra_utilizacao)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([nome, dias]) => ({
          nome,
          dias
        })),
      equipamentos: Object.entries(stats.equipamentos_utilizacao)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([nome, horas]) => ({
          nome,
          horas: horas.toFixed(1)
        })),
      ocorrencias: Object.entries(stats.ocorrencias_tipos).map(([tipo, quantidade]) => ({
        tipo,
        quantidade
      }))
    };

    return Response.json({
      sucesso: true,
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      estatisticas: stats,
      graficos,
      atividades_media_diaria: stats.total_diarios > 0 ? (stats.total_atividades / stats.total_diarios).toFixed(1) : 0,
      ocorrencias_media_diaria: stats.total_diarios > 0 ? (stats.total_ocorrencias / stats.total_diarios).toFixed(1) : 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});