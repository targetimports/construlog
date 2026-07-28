import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { insumo_id, almoxarifado_id, minimo, maximo, ponto_reposicao, lote_compra, ativo } = await req.json();

    if (!insumo_id || !almoxarifado_id) {
      return Response.json({ error: 'insumo_id e almoxarifado_id obrigatórios' }, { status: 400 });
    }

    // Buscar existente
    const existentes = await base44.entities.PoliticaEstoque.filter({
      insumo_id,
      almoxarifado_id
    });

    const data = {
      insumo_id,
      almoxarifado_id,
      minimo: minimo || 0,
      maximo: maximo || 0,
      ponto_reposicao: ponto_reposicao || 0,
      lote_compra: lote_compra || 1,
      ativo: ativo !== false
    };

    let resultado;
    if (existentes.length > 0) {
      // Update
      resultado = await base44.entities.PoliticaEstoque.update(existentes[0].id, data);
    } else {
      // Create
      resultado = await base44.entities.PoliticaEstoque.create(data);
    }

    return Response.json({ ok: true, data: resultado, message: 'Política salva' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});