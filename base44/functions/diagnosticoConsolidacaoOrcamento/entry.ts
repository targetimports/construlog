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

    const { obra_id, obraId, orcamento_id } = await safeJson(req, {});
    const obraIdFinal = obra_id || obraId || null;
    const avisos = [];

    if (!obraIdFinal && !orcamento_id) {
      avisos.push('Nenhum obra_id ou orcamento_id fornecido — contagens podem ser 0');
    }

    // COUNT ItemOrcamento por obra_id
    let ItemOrcamento_por_obra = 0;
    let ItemOrcamento_por_orcamento = 0;
    let ItemOrcamento_por_obra_e_orcamento = 0;
    let amostra_ItemOrcamento = [];

    if (obraIdFinal) {
      const por_obra = await base44.asServiceRole.entities.ItemOrcamento.filter(
        { obra_id: obraIdFinal }, '-created_date', 50000
      ).catch(() => []);
      ItemOrcamento_por_obra = por_obra.length;
      amostra_ItemOrcamento = por_obra.slice(0, 3).map(i => ({
        id: i.id,
        obra_id: i.obra_id,
        orcamento_id: i.orcamento_id,
        descricao: i.descricao,
        qtd: i.quantidade,
      }));
    }

    if (orcamento_id) {
      const por_orc = await base44.asServiceRole.entities.ItemOrcamento.filter(
        { orcamento_id }, '-created_date', 50000
      ).catch(() => []);
      ItemOrcamento_por_orcamento = por_orc.length;
    }

    if (obraIdFinal && orcamento_id) {
      const por_ambos = await base44.asServiceRole.entities.ItemOrcamento.filter(
        { obra_id: obraIdFinal, orcamento_id }, '-created_date', 50000
      ).catch(() => []);
      ItemOrcamento_por_obra_e_orcamento = por_ambos.length;
    }

    const contagens = {
      ItemOrcamento_por_obra,
      ItemOrcamento_por_orcamento,
      ItemOrcamento_por_obra_e_orcamento,
    };

    // Tentar contar OrcamentoItem se existir
    try {
      if (obraIdFinal) {
        const oi_obra = await base44.asServiceRole.entities.OrcamentoItem.filter(
          { obra_id: obraIdFinal }, '-created_date', 50000
        ).catch(() => null);
        if (oi_obra !== null) contagens.OrcamentoItem_por_obra = oi_obra.length;
      }
      if (orcamento_id) {
        const oi_orc = await base44.asServiceRole.entities.OrcamentoItem.filter(
          { orcamento_id }, '-created_date', 50000
        ).catch(() => null);
        if (oi_orc !== null) contagens.OrcamentoItem_por_orcamento = oi_orc.length;
      }
    } catch (_) {
      // OrcamentoItem não existe — ignora
    }

    // Verificar OrcamentoPlanejado
    let orcamentoPlanejado = null;
    if (obraIdFinal) {
      const [plano] = await base44.asServiceRole.entities.OrcamentoPlanejado.filter(
        { obra_id: obraIdFinal }, '-created_date', 1
      ).catch(() => []);
      if (plano) {
        let itensCount = 0;
        try {
          const parsed = typeof plano.estrutura_json === 'string'
            ? JSON.parse(plano.estrutura_json)
            : plano.estrutura_json;
          itensCount = (parsed?.itens?.length) || (parsed?.itensOrcamento?.length) || 0;
        } catch (_) {}
        orcamentoPlanejado = { id: plano.id, itens_na_estrutura_json: itensCount };
        if (itensCount === 0) avisos.push('OrcamentoPlanejado.estrutura_json sem itens parseable (itens[] ou itensOrcamento[])');
      } else {
        avisos.push('Nenhum OrcamentoPlanejado encontrado para essa obra');
      }
    }

    // Verificar OrcamentoConsolidacaoStatus
    let statusConsolidacao = null;
    if (obraIdFinal) {
      const [sc] = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.filter(
        { obra_id: obraIdFinal }, '-created_date', 1
      ).catch(() => []);
      if (sc) {
        statusConsolidacao = {
          id: sc.id, status: sc.status,
          total_itens: sc.total_itens,
          itens_consolidados: sc.itens_consolidados,
          itens_erro: sc.itens_erro,
          last_error: sc.last_error,
          finished_at: sc.finished_at,
        };
      } else {
        avisos.push('Nenhum OrcamentoConsolidacaoStatus encontrado para essa obra');
      }
    }

    // Verificar Orcamento
    let orcamento_info = null;
    if (obraIdFinal) {
      const [orc] = await base44.asServiceRole.entities.Orcamento.filter(
        { obra_id: obraIdFinal }, '-created_date', 1
      ).catch(() => []);
      if (orc) {
        orcamento_info = { id: orc.id, titulo: orc.titulo, versao: orc.versao, status: orc.status };
      } else {
        avisos.push('Nenhum Orcamento encontrado para essa obra — criação falhou ou ainda não ocorreu');
      }
    }

    if (ItemOrcamento_por_obra === 0 && obraIdFinal) {
      avisos.push('CRÍTICO: ItemOrcamento_por_obra = 0. Os itens não estão sendo gravados em ItemOrcamento com esse obra_id.');
    }

    return Response.json({
      ok: true,
      recebido: { obra_id: obraIdFinal, orcamento_id: orcamento_id || null },
      contagens,
      amostra_ItemOrcamento,
      orcamento_info,
      orcamentoPlanejado,
      statusConsolidacao,
      avisos,
    });
  } catch (error) {
    return Response.json({
      ok: false, error: error.message, code: 'INTERNAL',
      recebido: {}, contagens: {}, amostra_ItemOrcamento: [], avisos: [error.message],
    }, { status: 200 });
  }
});