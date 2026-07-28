import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const obraId = payload.obra_id;

    if (!obraId) {
      return Response.json(
        { error: 'obra_id é obrigatória' },
        { status: 400 }
      );
    }

    // Esta função é chamada do frontend para limpar o cache
    // No frontend, usar: 
    // await queryClient.invalidateQueries(['obra', obraId])
    // await queryClient.invalidateQueries(['orcamento-obra', obraId])
    // await queryClient.invalidateQueries(['marcos-obra', obraId])
    // await queryClient.invalidateQueries(['cronograma-obra', obraId])
    
    console.log('✅ Invalidar cache para obra:', obraId);
    
    return Response.json({
      success: true,
      message: 'Cache invalidado. Navegue para a obra para refetch dos dados.',
      queryKeys: [
        ['obra', obraId],
        ['orcamento-obra', obraId],
        ['marcos-obra', obraId],
        ['cronograma-obra', obraId],
        ['diagnostico-importacao', obraId]
      ]
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});