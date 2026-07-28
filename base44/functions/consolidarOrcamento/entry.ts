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

// Coerção simples da versão do orçamento
function coerceVersao(v) {
  if (v === null || v === undefined) return '1';
  if (typeof v === 'object') return '1';
  return String(v).trim() || '1';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obraId, dados_sintetico, import_run_id } = await safeJson(req, {});
    if (!obraId) return Response.json({ error: 'ID da obra é obrigatório.' }, { status: 400 });

    // Buscar ou criar status idempotente
    let [current] = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.filter({ obra_id: obraId }, '-created_date', 1);

    if (current) {
      if (current.status === 'DONE') {
        // Verificar se os itens realmente existem — se não, reprocessar
        const itensCheck = await base44.asServiceRole.entities.ItemOrcamento.filter(
          { obra_id: obraId }, '-created_date', 1
        ).catch(() => []);
        if (itensCheck.length > 0) {
          console.log(`[consolidarOrcamento] obraId=${obraId} já DONE com ${itensCheck.length} itens, jobId=${current.id}`);
          return Response.json({ jobId: current.id, status: 'done' });
        }
        // DONE mas sem itens — reprocessar
        console.log(`[consolidarOrcamento] obraId=${obraId} DONE mas sem itens — reprocessando`);
      }
      if (current.status === 'RUNNING') {
        console.log(`[consolidarOrcamento] obraId=${obraId} RUNNING - re-invocando processamento, jobId=${current.id}`);
        base44.functions.invoke('processarItensOrcamento', { obraId, statusId: current.id }).catch(async (err) => {
          console.error(`[consolidarOrcamento] Falha ao reiniciar job para obraId=${obraId}:`, err.message);
          await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(current.id, {
            status: 'ERROR',
            last_error: `Falha ao reiniciar processamento: ${err.message}`,
            finished_at: new Date().toISOString(),
          });
        });
        return Response.json({ jobId: current.id, status: 'running' }, { status: 202 });
      }
    }

    // Tentar obter total a partir do payload ou do OrcamentoPlanejado.estrutura_json
    let totalPrevisto = 0;
    if (dados_sintetico) {
      totalPrevisto = (dados_sintetico.itens?.length) || (dados_sintetico.itensOrcamento?.length) || 0;
    } else {
      const planos = await base44.asServiceRole.entities.OrcamentoPlanejado.filter({ obra_id: obraId }, '-created_date', 1);
      const plano = planos?.[0];
      if (plano?.estrutura_json) {
        try {
          const parsed = typeof plano.estrutura_json === 'string' ? JSON.parse(plano.estrutura_json) : plano.estrutura_json;
          totalPrevisto = (parsed?.itens?.length) || (parsed?.itensOrcamento?.length) || 0;
        } catch (_) {
          totalPrevisto = 0;
        }
      }
    }

    const obra = await base44.asServiceRole.entities.Obra.get(obraId).catch(() => null);

    if (!current) {
      current = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.create({
        obra_id: obraId,
        empresa_id: obra?.empresa_id || null,
        import_run_id: import_run_id || null,
        status: 'RUNNING',
        total_itens: totalPrevisto,
        itens_consolidados: 0,
        itens_erro: 0,
        started_at: new Date().toISOString(),
        finished_at: null,
        job_id: crypto.randomUUID?.() || `${Date.now()}`,
      });
    } else {
      current = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(current.id, {
        empresa_id: obra?.empresa_id || current.empresa_id || null,
        import_run_id: import_run_id || current.import_run_id || null,
        status: 'RUNNING',
        total_itens: totalPrevisto,
        itens_consolidados: 0,
        itens_erro: 0,
        last_error: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      });
    }

    // Garantir que o orçamento existente tenha versao string antes de processar
    const [orc] = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId }, '-created_date', 1);
    if (orc?.id) {
      const coerced = coerceVersao(orc.versao);
      if (coerced !== orc.versao) {
        try { await base44.asServiceRole.entities.Orcamento.update(orc.id, { versao: coerced }); } catch (_) {}
      }
    }

    // Disparar processamento assíncrono (best-effort)
    base44.functions.invoke('processarItensOrcamento', { obraId, statusId: current.id }).catch(async (err) => {
      console.error(`[consolidarOrcamento] Falha ao iniciar job para obraId=${obraId}:`, err.message);
      await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(current.id, {
        status: 'ERROR',
        last_error: `Falha ao iniciar processamento: ${err.message}`,
        finished_at: new Date().toISOString(),
      });
    });

    return Response.json({ jobId: current.id, status: 'running' }, { status: 202 });
  } catch (error) {
    console.error('[consolidarOrcamento] Erro:', error.message);
    return Response.json({ ok: false, error: error.message, code: 'INTERNAL_ERROR' }, { status: 200 });
  }
});