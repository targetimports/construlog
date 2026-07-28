import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar contexto do usuário (apenas IDs, sem carregar dados)
    const contextos = await base44.entities.ContextoUsuario.filter({ 
      user_email: user.email 
    });
    const contexto = contextos[0];

    let resposta = {
      user_email: user.email,
      obra_atual_id: contexto?.obra_atual_id || null,
      cliente_atual_id: contexto?.cliente_atual_id || null
    };

    return Response.json(resposta);
  } catch (error) {
    console.error('Erro ao buscar contexto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});