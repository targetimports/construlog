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

// Normalizador de payload do Orçamento (garante versao string)
function normalizeOrcamentoPayload(payload = {}) {
  const raw = payload.versao ?? payload.version ?? payload.versao_orcamento ?? '1';
  let versao = '1';
  if (raw === null || raw === undefined) versao = '1';
  else if (typeof raw === 'object') versao = '1';
  else versao = String(raw);
  versao = versao.trim();
  return { ...payload, versao };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await safeJson(req, {});
  // Aceitar tanto obraId quanto obra_id
  const obraId = body.obraId || body.obra_id || null;
  let statusId = body.statusId || body.status_id || null;
  let __dbgVersao = null;

  if (!obraId) return Response.json({ ok: false, code: 'MISSING_OBRA_ID', error: 'obraId é obrigatório' }, { status: 400 });

  // Se statusId não vier, buscar/criar o status da obra
  if (!statusId) {
    const [existente] = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.filter(
      { obra_id: obraId }, '-created_date', 1
    ).catch(() => []);
    if (existente?.id) {
      statusId = existente.id;
      console.log(`[processarItensOrcamento] statusId não veio, usando existente: ${statusId}`);
    } else {
      const novo = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.create({
        obra_id: obraId,
        status: 'RUNNING',
        total_itens: 0,
        itens_consolidados: 0,
        itens_erro: 0,
        started_at: new Date().toISOString(),
      });
      statusId = novo.id;
      console.log(`[processarItensOrcamento] statusId criado: ${statusId}`);
    }
  }

  let statusRow;
  try {
    statusRow = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.get(statusId);
    if (!statusRow) return Response.json({ error: 'Status não encontrado' }, { status: 404 });

    console.log(`[processarItensOrcamento] Início obraId=${obraId}, jobId=${statusRow.job_id || statusRow.id}`);

    // Revalidar status
    if (statusRow.status === 'DONE') {
      return Response.json({ message: 'Já concluído' });
    }
    if (statusRow.status !== 'RUNNING') {
      await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(statusId, {
        status: 'RUNNING',
        started_at: new Date().toISOString(),
        finished_at: null,
        last_error: null,
        itens_consolidados: 0,
        itens_erro: 0,
      });
    }

    // Marcar importação em processamento na Obra
    await base44.asServiceRole.entities.Obra.update(obraId, { import_status: 'PROCESSING' }).catch(() => {});

    // Obter fonte de itens do OrcamentoPlanejado
    const [plano] = await base44.asServiceRole.entities.OrcamentoPlanejado.filter({ obra_id: obraId }, '-created_date', 1);
    if (!plano?.estrutura_json) {
      throw new Error('Estrutura de orçamento não encontrada para a obra');
    }
    const parsed = typeof plano.estrutura_json === 'string' ? JSON.parse(plano.estrutura_json) : plano.estrutura_json;
    const itensSrcRaw = parsed?.itens || parsed?.itensOrcamento || [];
    // FILTRAR grupos (subtotais) para evitar duplicação de valores
    // Grupos são linhas que representam somas de sub-itens (is_grupo=true)
    const itensSrc = itensSrcRaw.filter(it => !it.is_grupo);
    console.log(`[processarItensOrcamento] Filtrados: ${itensSrcRaw.length} raw -> ${itensSrc.length} sem grupos`);

    // Encontrar ou criar Orçamento principal (sem usar schema como função)
    let [orc] = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId }, '-created_date', 1);
    if (!orc) {
      const todayDate = new Date().toISOString().slice(0, 10);
      const obraInfo = await base44.asServiceRole.entities.Obra.get(obraId).catch(() => null);
      const norm = normalizeOrcamentoPayload({ versao: '1' });
      __dbgVersao = norm.versao;
      orc = await base44.asServiceRole.entities.Orcamento.create({
        obra_id: obraId,
        empresa_id: obraInfo?.empresa_id || undefined,
        nome: `Orçamento Principal ${obraId}`,
        titulo: 'Orçamento Principal',
        versao: norm.versao,
        data_emissao: todayDate,
      });
    }

    // Garantir que versao esteja coerente como string também em orçamentos existentes
    if (orc && typeof orc.versao !== 'string') {
      const coerced = String(orc.versao ?? '1').trim();
      __dbgVersao = coerced;
      try { await base44.asServiceRole.entities.Orcamento.update(orc.id, { versao: coerced }); orc.versao = coerced; } catch (_) {}
    } else {
      __dbgVersao = (typeof orc?.versao === 'string') ? orc.versao : (__dbgVersao ?? '1');
    }

    // Idempotência: apagar itens existentes do orçamento (por obra_id para garantir limpeza total)
    const existentesOrc = await base44.asServiceRole.entities.ItemOrcamento.filter({ orcamento_id: orc.id }, '-created_date', 100000);
    if (existentesOrc?.length) {
      console.log(`[processarItensOrcamento] Limpando ${existentesOrc.length} itens existentes (orcamento_id=${orc.id})`);
      for (const it of existentesOrc) {
        await base44.asServiceRole.entities.ItemOrcamento.delete(it.id).catch(() => {});
      }
    }

    const itens_parseados = itensSrc.length;
    let ok = 0; let falha = 0;
    const total = itens_parseados;

    console.log(`[processarItensOrcamento] obraId=${obraId} orcamento_id=${orc.id} itens_parseados=${itens_parseados}`);

    if (total === 0) {
      await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(statusId, {
        status: 'ERROR',
        last_error: 'Nenhum item encontrado na estrutura do orçamento. Verifique o arquivo importado.',
        finished_at: new Date().toISOString(),
      });
      return Response.json({ ok: false, code: 'ZERO_ITEMS_IMPORTED', error: 'Nenhum item encontrado na estrutura do orçamento.',
        debug: { obraId, orcamento_id: orc.id, itens_parseados: 0, itens_persistidos: 0 }
      }, { status: 200 });
    }

    // Detectar duplicatas por descricao+quantidade+custo para evitar inserção dupla
    const seen = new Set();
    
    for (const it of itensSrc) {
      try {
        const qtd = Number(it.quantidade ?? it.qtd ?? 0) || 0;
        const vUnit = Number(it.custo_unitario ?? it.valor_unit ?? it.preco_unit ?? 0) || 0;
        let vTotal = Number(it.custo_total ?? it.total ?? it.preco_total ?? 0) || 0;
        if (!vTotal && qtd && vUnit) vTotal = Number((qtd * vUnit).toFixed(2));

        const desc = it.descricao || it.nome || it.item || 'Item do orçamento';
        const dedup = `${desc}|${qtd}|${vUnit}|${vTotal}`;
        if (seen.has(dedup)) {
          console.warn(`[processarItensOrcamento] Duplicata ignorada: ${dedup}`);
          continue;
        }
        seen.add(dedup);

        const itemData = {
          orcamento_id: orc.id,
          obra_id: obraId,   // ← CAMPO CRÍTICO: vincular sempre à obra
          descricao: desc,
          unidade: it.und || it.unidade || it.UND || 'UN',
          quantidade: qtd,
          custo_unitario: vUnit,
          custo_total: vTotal,
        };
        await base44.asServiceRole.entities.ItemOrcamento.create(itemData);
        ok++;
      } catch (e) {
        console.error('[processarItensOrcamento] Erro item:', e.message);
        falha++;
      }

      if ((ok + falha) % 20 === 0 || (ok + falha) === total) {
        await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(statusId, {
          itens_consolidados: ok,
          itens_erro: falha,
          total_itens: total,
        });
      }
    }

    const final = {
      status: falha > 0 ? 'ERROR' : 'DONE',
      itens_consolidados: ok,
      itens_erro: falha,
      total_itens: total,
      last_error: falha > 0 ? `${falha} itens com erro na consolidação.` : null,
      finished_at: new Date().toISOString(),
    };

    // Se houve erro estrutural (ex.: título/versão obrigatórios), registrar no last_error detalhado
    if (falha === total && total > 0) {
      final.status = 'ERROR';
      final.last_error = final.last_error || 'Falha estrutural ao criar itens; verifique campos obrigatórios do Orçamento e ItemOrcamento.';
    }
    // COUNT real na base para confirmar persistência
    const itensPersistidos = await base44.asServiceRole.entities.ItemOrcamento.filter(
      { obra_id: obraId }, '-created_date', 50000
    ).catch(() => []);
    const itens_persistidos = itensPersistidos.length;

    // Atualizar total_itens com a contagem real
    final.total_itens = itens_persistidos > 0 ? itens_persistidos : total;
    if (itens_persistidos > 0 && final.status !== 'ERROR') {
      final.itens_consolidados = itens_persistidos;
    }

    await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(statusId, final);

    // Atualizar status de importação da Obra
    await base44.asServiceRole.entities.Obra.update(obraId, {
      import_status: final.status === 'DONE' ? 'DONE' : 'ERROR',
      importada_orca_facil: final.status === 'DONE',
      importada_orca_facil_em: new Date().toISOString()
    }).catch(() => {});

    console.log(`[processarItensOrcamento] Fim obraId=${obraId} itens_parseados=${total} ok=${ok} erro=${falha} itens_persistidos=${itens_persistidos}`);
    return Response.json({
      success: true, ...final,
      debug: { obraId, orcamento_id: orc.id, itens_parseados: total, itens_persistidos, ok, falha }
    });
  } catch (error) {
    console.error('[processarItensOrcamento] Erro fatal:', error.message);
    console.error('[processarItensOrcamento][debug-versao]', { obra_id: obraId, versao: __dbgVersao, type: typeof __dbgVersao });
    if (statusRow?.id) {
      await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(statusRow.id, {
        status: 'ERROR',
        last_error: `Erro fatal: ${error.message}`,
        finished_at: new Date().toISOString(),
      });
    }
    // Marcar falha na Obra
    await base44.asServiceRole.entities.Obra.update(obraId, { import_status: 'ERROR' }).catch(() => {});
    return Response.json({ ok: false, error: error.message, code: 'INTERNAL_ERROR' }, { status: 200 });
  }
});