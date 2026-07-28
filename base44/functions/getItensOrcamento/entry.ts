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
    // Aceitar tanto obra_id quanto obraId
    const obra_id = body.obra_id || body.obraId || null;
    const orcamento_id = body.orcamento_id || body.orcamentoId || null;

    if (!obra_id) {
      return Response.json({ ok: false, code: 'MISSING_OBRA_ID', message: 'obra_id é obrigatório' }, { status: 400 });
    }

    console.log('[getItensOrcamento] obra_id=', obra_id, 'orcamento_id=', orcamento_id);

    // Buscar direto por obra_id em ItemOrcamento
    let filtro = { obra_id };
    if (orcamento_id) filtro.orcamento_id = orcamento_id;

    const itens = await base44.asServiceRole.entities.ItemOrcamento.filter(filtro, '-created_date', 100000);
    const lista = (itens || []).map(it => ({
      id: it.id,
      obra_id: it.obra_id,
      orcamento_id: it.orcamento_id,
      descricao: it.descricao || '—',
      unidade: it.unidade || '—',
      quantidade: Number(it.quantidade ?? 0) || 0,
      valor_unit: Number(it.custo_unitario ?? it.valor_unitario ?? 0) || 0,
      valor_total: Number(it.custo_total ?? it.valor_total ?? 0) || 0,
    }));

    console.log('[getItensOrcamento] total_itens=', lista.length);

    return Response.json({ ok: true, obra_id, total_itens: lista.length, itens: lista });
  } catch (error) {
    console.error('[getItensOrcamento] Erro:', error.message);
    return Response.json({ ok: false, code: 'INTERNAL_ERROR', message: error.message, itens: [], total_itens: 0 }, { status: 200 });
  }
});