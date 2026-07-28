import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const obra_id = url.searchParams.get('obra_id');
    const fornecedor_id = url.searchParams.get('fornecedor_id');
    const status = url.searchParams.get('status');
    const texto = url.searchParams.get('texto');
    const pagina = parseInt(url.searchParams.get('pagina') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const query = {};
    if (obra_id) query.obra_id = obra_id;
    if (fornecedor_id) query.fornecedor_id = fornecedor_id;
    if (status) query.status = status;

    let contratos = await base44.entities.Contrato.filter(query, '-updated_date', limit * 2);

    // Filtro por texto (numero ou titulo)
    if (texto) {
      contratos = contratos.filter(c => 
        (c.numero && c.numero.includes(texto)) || 
        (c.titulo && c.titulo.toLowerCase().includes(texto.toLowerCase()))
      );
    }

    // Paginação
    const total = contratos.length;
    const contratoPaginados = contratos.slice(pagina * limit, (pagina + 1) * limit);

    return Response.json({
      ok: true,
      contratos: contratoPaginados,
      total,
      pagina,
      limit,
      total_paginas: Math.ceil(total / limit)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});