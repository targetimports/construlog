import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Tenta encontrar obra "Administrativa"
    const obras = await base44.asServiceRole.entities.Obra.filter({ 
      nome: "Administrativa" 
    });

    if (obras && obras.length > 0) {
      return Response.json({ 
        ok: true, 
        obra_id: obras[0].id,
        novo: false
      });
    }

    // Criar obra Administrativa idempotente
    const novaObra = await base44.asServiceRole.entities.Obra.create({
      nome: "Administrativa",
      cliente: "Sistema",
      tipo: "privada",
      tipo_obra: "outros",
      fase: "ativa",
      status: "em_andamento",
      descricao: "Obra administrativa para lançamentos administrativos"
    });

    return Response.json({ 
      ok: true, 
      obra_id: novaObra.id,
      novo: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});