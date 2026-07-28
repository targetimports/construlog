import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { almoxarifado_id, insumo_id } = await req.json();

    let query = {};
    if (almoxarifado_id) query.almoxarifado_id = almoxarifado_id;
    if (insumo_id) query.insumo_id = insumo_id;

    const politicas = await base44.entities.PoliticaEstoque.filter(query || {}, '-updated_date', 100);

    return Response.json({ ok: true, data: politicas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});