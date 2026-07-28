import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_atual_id, cliente_atual_id } = await req.json();

    // Buscar contexto existente
    const contextos = await base44.entities.ContextoUsuario.filter({ 
      user_email: user.email 
    });
    const contextoExistente = contextos[0];

    let contextoParsed = {
      user_email: user.email,
      obra_atual_id: obra_atual_id || null,
      cliente_atual_id: cliente_atual_id || null,
      orcamento_atual_id: contextoExistente?.orcamento_atual_id || null
    };

    // Se temos obra_atual_id, sincronizar cliente automaticamente
    if (obra_atual_id) {
      const obras = await base44.entities.Obra.list();
      const obra = obras.find(o => o.id === obra_atual_id);
      if (obra && obra.cliente_id) {
        contextoParsed.cliente_atual_id = obra.cliente_id;
      }
    }

    // Atualizar ou criar contexto
    if (contextoExistente) {
      await base44.entities.ContextoUsuario.update(contextoExistente.id, contextoParsed);
    } else {
      await base44.entities.ContextoUsuario.create(contextoParsed);
    }

    // Retornar contexto completo usando getContextoAtual logic
    let resposta = {
      user_email: user.email,
      obra_atual: null,
      cliente_atual: null,
      resumo_obra: null
    };

    if (contextoParsed.obra_atual_id) {
      const obras = await base44.entities.Obra.list();
      const obra = obras.find(o => o.id === contextoParsed.obra_atual_id);
      
      if (obra) {
        resposta.obra_atual = obra;

        if (obra.cliente_id) {
          const clientes = await base44.entities.Cliente.list();
          const cliente = clientes.find(c => c.id === obra.cliente_id);
          if (cliente) resposta.cliente_atual = cliente;
        }

        const resumos = await base44.entities.ResumoObra.filter({ 
          obra_id: contextoParsed.obra_atual_id 
        });
        if (resumos[0]) {
          resposta.resumo_obra = resumos[0];
        }
      }
    } else if (contextoParsed.cliente_atual_id) {
      const clientes = await base44.entities.Cliente.list();
      const cliente = clientes.find(c => c.id === contextoParsed.cliente_atual_id);
      if (cliente) resposta.cliente_atual = cliente;
    }

    return Response.json(resposta);
  } catch (error) {
    console.error('Erro ao atualizar contexto:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});