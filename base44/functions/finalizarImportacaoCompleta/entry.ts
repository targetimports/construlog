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

function normalizeOrcamentoPayload(payload = {}) {
  const raw = payload.versao ?? payload.version ?? payload.versao_orcamento ?? '1';
  let versao = '1';
  if (raw === null || raw === undefined) versao = '1';
  else if (typeof raw === 'object') versao = '1';
  else versao = String(raw).trim() || '1';
  return { ...payload, versao };
}

// ─── PROCESSAMENTO SÍNCRONO DE ITENS ───────────────────────────────────────
// Extrai e persiste itens em ItemOrcamento dentro da mesma execução.
// Retorna { ok, itens_parseados, itens_persistidos, orcamento_id, erro? }
async function processarItensSync(base44, obraId, dadosSintetico) {
  // Pegar estrutura de itens do payload
  const itensSrcRaw = dadosSintetico?.itens || dadosSintetico?.itensOrcamento || [];
  // FILTRAR grupos (subtotais) para evitar duplicação — grupos são linhas com is_grupo=true
  // ou itens cujo "item" é apenas um número inteiro (ex: "1", "2") sem sub-itens detalhados
  const itensSrc = itensSrcRaw.filter(it => !it.is_grupo);
  const itens_parseados = itensSrc.length;
  console.log(`[processarItensSync] Filtrados: ${itensSrcRaw.length} raw -> ${itensSrc.length} sem grupos`);

  console.log(`[processarItensSync] obraId=${obraId} itens_parseados=${itens_parseados}`);

  if (itens_parseados === 0) {
    return { ok: false, itens_parseados: 0, itens_persistidos: 0, erro: 'Nenhum item encontrado na estrutura do orçamento' };
  }

  // Buscar ou criar Orcamento principal
  let [orc] = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId }, '-created_date', 1);
  if (!orc) {
    const norm = normalizeOrcamentoPayload({ versao: '1' });
    orc = await base44.asServiceRole.entities.Orcamento.create({
      obra_id: obraId,
      titulo: 'Orçamento Principal',
      versao: norm.versao,
      data_criacao: new Date().toISOString().slice(0, 10),
    });
  } else if (typeof orc.versao !== 'string') {
    const coerced = String(orc.versao ?? '1').trim();
    await base44.asServiceRole.entities.Orcamento.update(orc.id, { versao: coerced }).catch(() => {});
    orc.versao = coerced;
  }

  // Idempotência: limpar itens anteriores
  const existentes = await base44.asServiceRole.entities.ItemOrcamento.filter({ orcamento_id: orc.id }, '-created_date', 100000).catch(() => []);
  if (existentes.length > 0) {
    console.log(`[processarItensSync] Limpando ${existentes.length} itens existentes`);
    for (const it of existentes) {
      await base44.asServiceRole.entities.ItemOrcamento.delete(it.id).catch(() => {});
    }
  }

  // Inserir itens em lote
  let ok = 0; let falha = 0;
  let totalOrcamento = 0;
  
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
        console.warn(`[processarItensSync] Duplicata ignorada: ${dedup}`);
        continue;
      }
      seen.add(dedup);

      await base44.asServiceRole.entities.ItemOrcamento.create({
        orcamento_id: orc.id,
        obra_id: obraId,
        descricao: desc,
        unidade: it.und || it.unidade || it.UND || 'UN',
        quantidade: qtd,
        custo_unitario: vUnit,
        custo_total: vTotal,
      });
      totalOrcamento += vTotal;
      ok++;
    } catch (e) {
      console.error('[processarItensSync] Erro item:', e.message);
      falha++;
    }
  }

  // COUNT real para confirmar
  const confirmados = await base44.asServiceRole.entities.ItemOrcamento.filter(
    { obra_id: obraId }, '-created_date', 50000
  ).catch(() => []);
  const itens_persistidos = confirmados.length;

  console.log(`[processarItensSync] ok=${ok} falha=${falha} itens_persistidos=${itens_persistidos} totalOrcamento=${totalOrcamento}`);

  if (itens_persistidos === 0) {
    return { ok: false, itens_parseados, itens_persistidos: 0, orcamento_id: orc.id, erro: `Nenhum item foi persistido. ok=${ok} falha=${falha}` };
  }

  return { ok: true, itens_parseados, itens_persistidos, orcamento_id: orc.id, totalOrcamento };
}

// ─── HANDLER PRINCIPAL ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await safeJson(req, {});
    if (!payload || Object.keys(payload).length === 0) {
      return Response.json({ ok: false, error: 'Body obrigatório', code: 'MISSING_FIELDS' }, { status: 400 });
    }

    console.log('[finalizarImportacaoCompleta] Iniciando com payload:', {
      import_run_id: payload.import_run_id,
      tem_sintetico: !!payload.dados_sintetico,
      tem_cronograma: !!payload.cronograma,
      tem_dados_obra: !!payload.dados_obra
    });

    // VALIDAÇÕES
    if (!payload.dados_sintetico) throw new Error('Orçamento sintético obrigatório');
    if (!payload.cronograma || !payload.cronograma.atividades || payload.cronograma.atividades.length === 0) {
      throw new Error('Cronograma vazio — importação cancelada. Cronograma é obrigatório.');
    }
    if (!payload.dados_obra) throw new Error('Dados da obra obrigatórios');

    // 1. CRIAR OBRA
    const obraDados = payload.dados_obra || {};
    const clienteNome = obraDados.cliente ?? obraDados.cliente_nome ?? obraDados.client ?? obraDados.client_name;
    const clienteId = obraDados.cliente_id ?? obraDados.client_id;
    if (!clienteNome) {
      return Response.json({ error: 'Validação: cliente é obrigatório.' }, { status: 400 });
    }

    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: obraDados.nome,
      cliente: clienteNome,
      cliente_id: clienteId || undefined,
      endereco: obraDados.endereco || undefined,
      cidade: obraDados.cidade || undefined,
      estado: obraDados.estado || undefined,
      cep: obraDados.cep || undefined,
      data_inicio: obraDados.data_inicio || undefined,
      data_prevista_fim: obraDados.data_prevista_fim || obraDados.data_fim_prevista || undefined,
      tipo: obraDados.tipo || 'privada',
      tipo_obra: obraDados.tipo_obra || 'outros',
      categoria_dre: obraDados.categoria_dre || 'OUTRO',
      tipo_estrutural: obraDados.tipo_estrutural || 'OUTRO',
      tipo_intervencao: obraDados.tipo_intervencao || 'INDEFINIDA',
      status: 'a_iniciar',
      import_status: 'PROCESSING',
    });
    const obraId = obra.id;
    console.log('[finalizarImportacaoCompleta] Obra criada:', obraId);

    // 2. SALVAR ORÇAMENTO PLANEJADO
    const normOrc = normalizeOrcamentoPayload(payload.dados_sintetico || {});
    await base44.asServiceRole.entities.OrcamentoPlanejado.create({
      obra_id: obraId,
      total_geral: payload.dados_sintetico.totalGeral || 0,
      total_sem_bdi: payload.dados_sintetico.totalSemBDI || 0,
      total_bdi: payload.dados_sintetico.totalBDI || 0,
      bdi_percentual: payload.dados_sintetico.percentualBDI || 0,
      estrutura_json: JSON.stringify({ ...payload.dados_sintetico, versao: normOrc.versao }),
      status: 'Ativo'
    });

    // 3. SALVAR CRONOGRAMA
    const faltandoDatas = (payload.cronograma.atividades || []).map((a, idx) => ({
      idx,
      nome: a.nome || a.atividade || a.nomeAtividade || `Atividade ${idx + 1}`,
      inicio: a.inicio || a.dataInicioPlanejada || a.data_inicio_planejada || a.data_inicio,
      fim: a.fim || a.dataFimPlanejada || a.data_fim_planejada || a.data_fim
    })).filter(a => !a.inicio || !a.fim);

    if (faltandoDatas.length > 0) {
      await base44.asServiceRole.entities.Obra.delete(obraId).catch(() => {});
      return Response.json({
        error: 'Validação: datas planejadas ausentes em atividades',
        details: {
          total_invalidas: faltandoDatas.length,
          faltando_inicio: faltandoDatas.filter(a => !a.inicio).map(a => a.nome),
          faltando_fim: faltandoDatas.filter(a => !a.fim).map(a => a.nome)
        }
      }, { status: 400 });
    }

    console.log('[finalizarImportacaoCompleta] Salvando cronograma com', payload.cronograma.atividades.length, 'atividades...');
    for (const atividade of payload.cronograma.atividades) {
      await base44.asServiceRole.entities.CronogramaItem.create({
        obraId: obraId,
        nomeAtividade: atividade.nome || atividade.atividade || 'Atividade',
        dataInicioPlanejada: (atividade.inicio || atividade.dataInicioPlanejada || atividade.data_inicio_planejada || atividade.data_inicio)
          ? new Date(atividade.inicio || atividade.dataInicioPlanejada || atividade.data_inicio_planejada || atividade.data_inicio).toISOString().split('T')[0]
          : undefined,
        dataFimPlanejada: (atividade.fim || atividade.dataFimPlanejada || atividade.data_fim_planejada || atividade.data_fim)
          ? new Date(atividade.fim || atividade.dataFimPlanejada || atividade.data_fim_planejada || atividade.data_fim).toISOString().split('T')[0]
          : undefined,
        quantidadePlanejada: atividade.qtd || atividade.quantidade || 0,
        und: atividade.und || atividade.unidade || undefined,
        status: 'Não iniciado',
        percentualConcluido: 0
      });
    }

    // Verificar persistência do cronograma
    const cronogramaSalvo = await base44.asServiceRole.entities.CronogramaItem.filter({ obraId: obraId }, '-created_date', 1000);
    if (!cronogramaSalvo || cronogramaSalvo.length === 0) {
      await base44.asServiceRole.entities.Obra.delete(obraId).catch(() => {});
      throw new Error('Falha crítica: Cronograma não foi persistido. Importação cancelada e obra deletada.');
    }

    // 4. PROCESSAR ITENS DO ORÇAMENTO — SÍNCRONO (causa raiz do 0/0)
    console.log('[finalizarImportacaoCompleta] Processando itens do orçamento de forma SÍNCRONA...');
    const resultItens = await processarItensSync(base44, obraId, payload.dados_sintetico);

    if (!resultItens.ok) {
      // Itens não persistidos — falha real, não sucesso falso
      console.error('[finalizarImportacaoCompleta] ZERO itens persistidos:', resultItens.erro);

      // Registrar status de erro
      await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.create({
        obra_id: obraId,
        status: 'ERROR',
        total_itens: 0,
        itens_consolidados: 0,
        itens_erro: resultItens.itens_parseados,
        last_error: resultItens.erro,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      }).catch(() => {});

      await base44.asServiceRole.entities.Obra.update(obraId, { import_status: 'ERROR' }).catch(() => {});

      return Response.json({
        ok: false,
        code: 'ZERO_ITEMS_IMPORTED',
        message: resultItens.erro || 'Nenhum item do orçamento foi persistido',
        debug: {
          obra_id: obraId,
          itens_parseados: resultItens.itens_parseados,
          itens_persistidos: 0,
        }
      }, { status: 200 });
    }

    // ✅ Itens persistidos com sucesso — criar status DONE diretamente
    const statusFinal = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.create({
      obra_id: obraId,
      status: 'DONE',
      total_itens: resultItens.itens_persistidos,
      itens_consolidados: resultItens.itens_persistidos,
      itens_erro: 0,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    }).catch(() => null);

    // Atualizar obra com orçamento calculado + campos de responsáveis
    const obraDadosCompletosParaAtualizar = {
      import_status: 'DONE',
      importada_orca_facil: true,
      importada_orca_facil_em: new Date().toISOString(),
      total_orcamento: resultItens.totalOrcamento || 0,
    };

    // Preenchendo campos de responsáveis se vierem no payload
    if (payload.dados_obra?.responsavel_tecnico) {
      obraDadosCompletosParaAtualizar.responsavel_tecnico = payload.dados_obra.responsavel_tecnico;
    }
    if (payload.dados_obra?.responsavel_obra) {
      obraDadosCompletosParaAtualizar.responsavel_obra = payload.dados_obra.responsavel_obra;
    }
    if (payload.dados_obra?.centro_custo_codigo) {
      obraDadosCompletosParaAtualizar.centro_custo_codigo = payload.dados_obra.centro_custo_codigo;
    }
    if (payload.dados_obra?.centro_custo_nome) {
      obraDadosCompletosParaAtualizar.centro_custo_nome = payload.dados_obra.centro_custo_nome;
    }

    await base44.asServiceRole.entities.Obra.update(obraId, obraDadosCompletosParaAtualizar).catch((err) => {
      console.error('[finalizarImportacaoCompleta] Erro ao atualizar obra:', err.message);
    });

    console.log(`[finalizarImportacaoCompleta] ✅ Importação CONCLUÍDA obraId=${obraId} itens_parseados=${resultItens.itens_parseados} itens_persistidos=${resultItens.itens_persistidos} totalOrcamento=${resultItens.totalOrcamento}`);

    return Response.json({
      ok: true,
      success: true,
      obra_id: obraId,
      total_orcamento_confirmado: resultItens.totalOrcamento || payload.dados_sintetico.totalGeral || 0,
      cronograma_items: cronogramaSalvo.length,
      import_run_id: payload.import_run_id,
      // Consolidação já concluída — UI não precisa fazer polling
      consolidado: true,
      total_itens: resultItens.itens_persistidos,
      processados: resultItens.itens_persistidos,
      consolidacao_status_id: statusFinal?.id || null,
      debug: {
        obra_id: obraId,
        total_orcamento_calculado: resultItens.totalOrcamento,
        itens_parseados: resultItens.itens_parseados,
        itens_persistidos: resultItens.itens_persistidos,
        orcamento_id: resultItens.orcamento_id,
        responsavel_tecnico: payload.dados_obra?.responsavel_tecnico || null,
        responsavel_obra: payload.dados_obra?.responsavel_obra || null,
        centro_custo: payload.dados_obra?.centro_custo_codigo || null,
      }
    });

  } catch (error) {
    console.error('[finalizarImportacaoCompleta] Erro:', error.message);
    return Response.json({ ok: false, error: error.message, code: 'INTERNAL_ERROR' }, { status: 500 });
  }
});