import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validador centralizado: garante que obra_id está presente e válido
 * Bloqueia lançamento se obra_id faltar
 * EXCEÇÃO: administrativo pode usar Obra Administrativa (auto-criada)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { obra_id, is_administrativo } = body;

    // Se é administrativo, permite sem obra_id (será preenchido com Obra Administrativa)
    if (is_administrativo === true) {
      return Response.json({ 
        ok: true, 
        message: 'Administrativo detectado - Obra Administrativa será usada',
        permitir_sem_obra: true 
      });
    }

    // Para todos os outros casos, obra_id é obrigatório
    if (!obra_id || !String(obra_id).trim()) {
      return Response.json({
        ok: false,
        error: 'OBRA_REQUIRED',
        message: 'Selecione uma obra para prosseguir'
      }, { status: 422 });
    }

    // Validar se obra_id existe e é válida
    try {
      const obra = await base44.entities.Obra.filter({ id: obra_id });
      if (!obra || obra.length === 0) {
        return Response.json({
          ok: false,
          error: 'OBRA_NOT_FOUND',
          message: 'Obra selecionada não existe'
        }, { status: 404 });
      }
    } catch (err) {
      return Response.json({
        ok: false,
        error: 'OBRA_VALIDATION_ERROR',
        message: 'Erro ao validar obra'
      }, { status: 500 });
    }

    return Response.json({ 
      ok: true, 
      message: 'Obra validada com sucesso',
      obra_id
    });

  } catch (error) {
    console.error('Erro em validateObraRequired:', error);
    return Response.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    }, { status: 500 });
  }
});