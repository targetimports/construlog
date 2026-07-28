import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { viagem_id, km_inicial, combustivel_inicial_percent } = await req.json();

    if (!viagem_id) {
      return Response.json({ error: 'viagem_id obrigatório' }, { status: 400 });
    }

    const viagens = await base44.entities.Viagem.list();
    const viagem = viagens.find(v => v.id === viagem_id);

    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    // Validar permissão: motorista ou admin
    if (viagem.motorista_user_id !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const atualizada = await base44.entities.Viagem.update(
      viagem_id,
      {
        status: 'em_andamento',
        saida_real: new Date().toISOString(),
        km_inicial: km_inicial || null,
        combustivel_inicial_percent: combustivel_inicial_percent || null
      }
    );

    return Response.json({
      success: true,
      viagem: atualizada
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});