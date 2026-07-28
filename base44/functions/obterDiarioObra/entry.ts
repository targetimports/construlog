import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para obter um diário da obra por obra_id e data
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { obra_id, data } = await req.json();

    if (!obra_id || !data) {
      return Response.json({ 
        error: 'obra_id e data são obrigatórios' 
      }, { status: 400 });
    }

    // Buscar diário
    const diarios = await base44.entities.DiarioObra.filter({
      obra_id: obra_id,
      data: data
    });

    if (!diarios || diarios.length === 0) {
      return Response.json({
        diario: null,
        existe: false
      });
    }

    const diario = diarios[0];

    return Response.json({
      diario: {
        id: diario.id,
        obra_id: diario.obra_id,
        data: diario.data,
        producao_texto: diario.producao_texto,
        observacao_geral: diario.observacao_geral,
        status_registro: diario.status_registro,
        qtd_funcionarios: diario.qtd_funcionarios,
        fechado_por: diario.fechado_por,
        fechado_em: diario.fechado_em,
        created_date: diario.created_date,
        updated_date: diario.updated_date
      },
      existe: true,
      estaBloqueado: diario.status_registro === 'CONCLUIDO'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});