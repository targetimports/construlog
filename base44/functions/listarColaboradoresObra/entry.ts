import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Função para listar colaboradores vinculados a uma obra
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { obra_id, mostrarInativos = false } = await req.json();

    if (!obra_id) {
      return Response.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    // Obter vínculosda obra
    const vinculos = await base44.entities.ObraColaborador.filter({
      obra_id: obra_id
    });

    if (!vinculos || vinculos.length === 0) {
      return Response.json({
        obra_id,
        colaboradores: [],
        total: 0
      });
    }

    // Buscar todos os colaboradores vinculados de uma vez (mais eficiente)
    const colabIds = [...new Set(vinculos.map(v => v.colaborador_id).filter(Boolean))];
    let todosColabs = [];
    if (colabIds.length > 0) {
      try {
        todosColabs = await base44.asServiceRole.entities.Colaborador.list();
      } catch (e) {
        console.warn('[listarColaboradoresObra] Erro ao listar colaboradores:', e.message);
      }
    }
    const colabMap = {};
    for (const c of todosColabs) {
      colabMap[c.id] = c;
    }

    // Enriquecer com dados do colaborador
    const colaboradoresEnriquecidos = vinculos.map((vinculo) => {
      const colab = colabMap[vinculo.colaborador_id];
      return {
        vinculo_id: vinculo.id,
        colaborador_id: vinculo.colaborador_id,
        nome: colab?.nome || 'Desconhecido',
        cargo: colab?.cargo || '',
        funcao_na_obra: vinculo.funcao_na_obra,
        status: vinculo.ativo !== false ? 'ativo' : 'inativo',
        data_inicio: vinculo.data_inicio,
        data_fim: vinculo.data_fim
      };
    });

    // Filtrar inativos se necessário
    const filtrados = mostrarInativos 
      ? colaboradoresEnriquecidos
      : colaboradoresEnriquecidos.filter(c => c.status === 'ativo');

    return Response.json({
      obra_id,
      colaboradores: filtrados,
      total: filtrados.length,
      totalComInativos: colaboradoresEnriquecidos.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});