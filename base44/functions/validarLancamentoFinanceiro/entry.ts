import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { categoria_id, centro_custo_id, obra_id, administrativo } = payload;

    // Validação 1: categoria_id obrigatório
    if (!categoria_id) {
      return Response.json({ error: 'categoria_id obrigatório' }, { status: 400 });
    }

    // Validação 2: categoria_id existe
    const categoria = await base44.entities.CategoriaFinanceira.filter({ id: categoria_id });
    if (!categoria || categoria.length === 0) {
      return Response.json({ error: 'CategoriaFinanceira não encontrada' }, { status: 404 });
    }

    // Validação 3: centro_custo_id obrigatório
    if (!centro_custo_id) {
      return Response.json({ error: 'centro_custo_id obrigatório' }, { status: 400 });
    }

    // Validação 4: centro_custo_id existe
    const centroCusto = await base44.entities.CentroCusto.filter({ id: centro_custo_id });
    if (!centroCusto || centroCusto.length === 0) {
      return Response.json({ error: 'CentroCusto não encontrado' }, { status: 404 });
    }

    // Validação 5: obra_id ou administrativo=true
    let obraFinal = obra_id;
    if (administrativo === true) {
      // Buscar ou criar ObraAdministrativa
      const obraAdm = await base44.asServiceRole.functions.invoke('getOrCreateObraAdministrativa', {});
      obraFinal = obraAdm.obra_id;
    } else if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório (ou administrativo=true)' }, { status: 400 });
    } else {
      const obra = await base44.entities.Obra.filter({ id: obra_id });
      if (!obra || obra.length === 0) {
        return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
      }
    }

    const normalizado = {
      ...payload,
      categoria_id,
      centro_custo_id,
      obra_id: obraFinal,
      administrativo: administrativo === true
    };

    return Response.json({ ok: true, payload: normalizado, warnings: [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});