import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rota_id } = await req.json();

    if (!rota_id) {
      return Response.json({ error: 'rota_id é obrigatório' }, { status: 400 });
    }

    // Atualizar rota para "em_andamento"
    const rotaAtualizada = await base44.entities.RotaMotorista.update(rota_id, {
      status: 'em_andamento',
      data_hora_saida: new Date().toISOString()
    });

    return Response.json({
      success: true,
      rota: rotaAtualizada,
      message: 'Viagem iniciada! Rastreamento em tempo real ativado.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});