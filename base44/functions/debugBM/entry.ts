/**
 * debugBM: endpoint temporário para diagnosticar BMs
 * Uso: invoke('debugBM', { obra_id: '...' })
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) {}

    const obra_id = payload.obra_id || payload.obraId;

    // 1. Todas as BMs sem filtro
    const todasBMs = await base44.entities.BM.list('-created_date', 20) || [];
    console.log('[debugBM] total BMs (sem filtro):', todasBMs.length);
    console.log('[debugBM] primeiras 5:', JSON.stringify(todasBMs.slice(0, 5).map(b => ({
      id: b.id, obra_id: b.obra_id, status: b.status, numero: b.numero, created_date: b.created_date
    }))));

    // 2. BMs por obra_id (se fornecido)
    let bmsPorObra = [];
    if (obra_id) {
      bmsPorObra = await base44.entities.BM.filter({ obra_id }) || [];
      console.log(`[debugBM] BMs com obra_id=${obra_id}:`, bmsPorObra.length);
    }

    // 3. Obras disponíveis
    const obras = await base44.entities.Obra.list('-created_date', 10) || [];
    console.log('[debugBM] obras:', obras.map(o => ({ id: o.id, nome: o.nome, status: o.status })));

    // 4. ContratoVersoes
    const versoes = obra_id
      ? await base44.entities.ContratoVersao.filter({ obra_id }) || []
      : await base44.entities.ContratoVersao.list('-created_date', 10) || [];
    console.log('[debugBM] versões contrato:', versoes.map(v => ({ id: v.id, obra_id: v.obra_id, status: v.status })));

    return Response.json({
      debug: true,
      obra_id_filtrado: obra_id || null,
      total_bm_sem_filtro: todasBMs.length,
      ultimas_5_bm: todasBMs.slice(0, 5).map(b => ({
        id: b.id,
        obra_id: b.obra_id,
        contrato_versao_id: b.contrato_versao_id,
        status: b.status,
        numero: b.numero,
        created_date: b.created_date
      })),
      bms_por_obra: bmsPorObra.slice(0, 10).map(b => ({
        id: b.id,
        obra_id: b.obra_id,
        status: b.status,
        numero: b.numero
      })),
      obras: obras.map(o => ({ id: o.id, nome: o.nome })),
      versoes_contrato: versoes.map(v => ({ id: v.id, obra_id: v.obra_id, status: v.status }))
    });

  } catch (error) {
    console.error('[debugBM]', error?.message);
    return Response.json({ error: error?.message }, { status: 500 });
  }
});