import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function safeJson(req, fallback = {}) {
  const method = (req.method || '').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return fallback;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') return fallback;
    return JSON.parse(text);
  } catch (_) { return fallback; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await safeJson(req, {});
    const { obraId } = body;
    if (!obraId) return Response.json({ ok: false, error: 'obraId é obrigatório', code: 'MISSING_OBRA_ID' }, { status: 400 });

    // debug mode: ?debug=1 na URL ou debug:true no body
    const urlDebug = (req.url || '').includes('debug=1');
    const isDebug = urlDebug || body.debug === true || body.debug === 1 || body.debug === '1';

    // 1) TOTAL REAL: fonte de verdade = ItemOrcamento WHERE obra_id = obraId
    const itensDb = await base44.asServiceRole.entities.ItemOrcamento.filter(
      { obra_id: obraId },
      '-created_date',
      50000,
    );
    const total_itens = itensDb.length;

    // orcamento_id do primeiro item (para debug)
    const orcamento_id_sample = itensDb[0]?.orcamento_id || null;

    // 2) STATUS de consolidação mais recente para a obra
    const [statusRow] = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.filter(
      { obra_id: obraId },
      '-created_date',
      1,
    );

    const erro_fatal = statusRow?.last_error || null;
    const dbStatus = statusRow?.status || null; // PENDING | RUNNING | DONE | ERROR

    // 3) processados = itens_consolidados, nunca > total_itens
    //    Se DONE e sem erro => processados = total_itens (banco é fonte de verdade)
    let processados = 0;
    if (dbStatus === 'DONE' && !erro_fatal) {
      processados = total_itens;
    } else if (dbStatus === 'RUNNING') {
      processados = Math.min(Number(statusRow?.itens_consolidados || 0), total_itens);
    } else {
      processados = Math.min(Number(statusRow?.itens_consolidados || 0), total_itens);
    }

    // 4) Regras de estado
    const consolidado = total_itens > 0 && processados >= total_itens && !erro_fatal;
    const pendente = !consolidado && !erro_fatal;

    // Determinar status normalizado para a UI
    let status = 'pending';
    if (dbStatus === 'RUNNING') status = 'processing';
    else if (dbStatus === 'ERROR' || erro_fatal) status = 'error';
    else if (consolidado) status = 'done';

    const ultima_atualizacao =
      statusRow?.updated_date ||
      statusRow?.finished_at ||
      statusRow?.started_at ||
      new Date().toISOString();

    const resp = {
      ok: true,
      obra_id: obraId,
      total_itens,
      processados,
      consolidado,
      pendente,
      erro_fatal,
      status,
      ultima_atualizacao,
    };

    if (isDebug) {
      resp.debug = {
        fonte_contagem: 'ItemOrcamento',
        filtros: { obra_id: obraId, orcamento_id: orcamento_id_sample },
        total_itens,
        processados,
        db_status: dbStatus,
        itens_consolidados_raw: statusRow?.itens_consolidados ?? null,
        status_id: statusRow?.id ?? null,
      };
    }

    return Response.json(resp);
  } catch (error) {
    console.error('[getOrcamentoConsolidacaoStatus] Erro:', error.message);
    return Response.json({
      ok: false, error: error.message, code: 'INTERNAL_ERROR',
      obra_id: null, total_itens: 0, processados: 0, consolidado: false, pendente: true,
      erro_fatal: error.message, status: 'error',
      ultima_atualizacao: new Date().toISOString(),
    }, { status: 200 });
  }
});