import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Recalcula Equipe.colaboradores_ids a partir de EquipeMembro ativos
 * Source of truth: EquipeMembro
 * colaboradores_ids é apenas um cache para compatibilidade
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { equipe_id } = body;

    if (!equipe_id) {
      return Response.json({
        ok: false,
        error: 'Missing equipe_id'
      }, { status: 400 });
    }

    console.log(`[RECALC] Iniciando recálculo para equipe_id=${equipe_id}`);

    // 1. Listar EquipeMembro ativos
    const membrosVinculos = await base44.asServiceRole.entities.EquipeMembro.filter({
      equipe_id,
      status: 'ativo'
    });

    console.log(`[RECALC] Encontrados ${membrosVinculos.length} membros ativos`);

    // 2. Extrair IDs
    const idsAtivos = membrosVinculos.map(m => m.colaborador_id);

    console.log(`[RECALC] IDs: ${JSON.stringify(idsAtivos)}`);

    // 3. Atualizar Equipe.colaboradores_ids
    await base44.asServiceRole.entities.Equipe.update(equipe_id, {
      colaboradores_ids: idsAtivos
    });

    console.log(`[RECALC] Equipe.colaboradores_ids atualizado com ${idsAtivos.length} membros`);

    return Response.json({
      ok: true,
      equipe_id,
      membros_ativos: idsAtivos.length,
      ids: idsAtivos
    });

  } catch (error) {
    console.error('[ERROR] recalcularColaboradoresIdsEquipe:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});