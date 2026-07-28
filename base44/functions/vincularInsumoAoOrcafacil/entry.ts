import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { insumo_id, codigo_orcafacil, preco_referencia } = await req.json();

    if (!insumo_id || !codigo_orcafacil || typeof preco_referencia !== 'number') {
      return Response.json({
        error: 'insumo_id, codigo_orcafacil e preco_referencia são obrigatórios'
      }, { status: 400 });
    }

    // Buscar insumo
    const insumo = await base44.asServiceRole.entities.Insumo.read(insumo_id);
    if (!insumo) {
      return Response.json({ error: 'Insumo não encontrado' }, { status: 404 });
    }

    // Atualizar insumo com dados do OrçaFácil
    // IMPORTANTE: NÃO alteramos preco_ultima_compra (estoque/real)
    const insumoAtualizado = await base44.asServiceRole.entities.Insumo.update(insumo_id, {
      codigo_orcafacil,
      preco_referencia,
      origem: 'orcafacil',
      // Registrar no histórico
      historico_precos: [
        ...(insumo.historico_precos || []),
        {
          preco: preco_referencia,
          data: new Date().toISOString().split('T')[0],
          usuario: user.email,
          tipo: 'referencia'
        }
      ]
    });

    return Response.json({
      success: true,
      insumo: insumoAtualizado,
      mensagem: 'Insumo vinculado ao OrçaFácil. Preço de referência atualizado, estoque preservado.'
    });
  } catch (error) {
    console.error('Erro ao vincular insumo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});