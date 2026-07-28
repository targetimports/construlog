import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para aprovar um diário da obra (congelando dados)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar permissão: apenas admin pode aprovar
    if (user.role !== 'admin') {
      return Response.json({ 
        error: 'Apenas administradores podem aprovar diários' 
      }, { status: 403 });
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

    // Verificar se já está aprovado
    if (diario.status_registro === 'CONCLUIDO') {
      return Response.json({ 
        error: 'Diário já foi aprovado' 
      }, { status: 409 });
    }

    // Aprovar diário (marcar como CONCLUIDO/congelado)
    const diarioAprovado = await base44.entities.DiarioObra.update(diario_id, {
      status_registro: 'CONCLUIDO',
      fechado_por: user.email,
      fechado_em: new Date().toISOString()
    });

    return Response.json({
      message: 'Diário aprovado com sucesso',
      diario: diarioAprovado
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});