import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para obter um diário da obra com todos os seus relacionamentos
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { diario_id } = await req.json();
    if (!diario_id) {
      return Response.json({ error: 'diario_id é obrigatório' }, { status: 400 });
    }

    // Obter diário
    const diario = await base44.entities.DiarioObra.get(diario_id);
    if (!diario) {
      return Response.json({ error: 'Diário não encontrado' }, { status: 404 });
    }

    // Obter itens do diário
    const itens = await base44.entities.DiarioObraEquipe.filter({
      diario_id: diario_id
    });

    // Obter motivos vinculados
    const motivos = await base44.entities.DiarioObraMotivo.filter({
      diario_id: diario_id
    });

    // Obter mídias vinculadas
    const midias = await base44.entities.DiarioObraMidia.filter({
      diario_id: diario_id
    });

    // Enriquecer motivos com nomes do catálogo
    const motivosEnriquecidos = await Promise.all(
      motivos.map(async (m) => {
        const motivo = await base44.entities.MotivoCatalogo.get(m.motivo_id);
        return {
          id: m.id,
          motivo_id: m.motivo_id,
          motivo_nome: motivo?.nome || 'Desconhecido',
          observacao: m.observacao
        };
      })
    );

    // Enriquecer itens com nomes dos colaboradores
    const itensEnriquecidos = await Promise.all(
      itens.map(async (item) => {
        const colab = await base44.entities.Colaborador.get(item.colaborador_id);
        return {
          id: item.id,
          colaborador_id: item.colaborador_id,
          colaborador_nome: colab?.nome || 'Desconhecido',
          presente: item.presente,
          falta: item.falta,
          horas_extra: item.horas_extra,
          observacao: item.observacao
        };
      })
    );

    return Response.json({
      diario: {
        id: diario.id,
        obra_id: diario.obra_id,
        data: diario.data,
        producao_texto: diario.producao_texto,
        observacao_geral: diario.observacao_geral,
        status: diario.status_registro,
        created_at: diario.created_date
      },
      itens: itensEnriquecidos,
      motivos: motivosEnriquecidos,
      midias: midias
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});