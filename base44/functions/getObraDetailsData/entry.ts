import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// touch: redeploy 2026-02-26 18:30:00

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { obra_id } = body;
    if (!obra_id) return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });

    // 1. Buscar obra — id pode ser UUID (padrão) ou codigo da obra
    let obras = [];
    try {
      obras = await base44.entities.Obra.filter({ id: obra_id }) || [];
    } catch (_) {
      // id inválido (ex: UUID malformado) — tentar por codigo
    }
    if (!obras || obras.length === 0) {
      obras = await base44.entities.Obra.filter({ codigo: obra_id }) || [];
    }
    const obra = obras?.[0] || null;
    if (!obra) return Response.json({ error: 'Obra não encontrada' }, { status: 404 });

    // Garantir que usamos o ID real da obra (não o código)
    const realObraId = obra.id;

    // 2. Buscar orçamento (primeiro vigente, senão o mais recente)
    let orcamentos = await base44.entities.Orcamento.filter({ obra_id: realObraId });
    orcamentos = orcamentos || [];
    const orcamentoAtivo = orcamentos.find(o => o.status === 'vigente' || o.status === 'aprovado') || orcamentos[0] || null;

    let itensOrcamento = [];
    if (orcamentoAtivo) {
      itensOrcamento = await base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoAtivo.id }) || [];
    }

    const somaItens = itensOrcamento.reduce((s, i) => s + (i.valor_total || i.custo_total || 0), 0);
    const valorOrcado =
      (obra.total_final_orcamento > 0 ? obra.total_final_orcamento : null) ??
      (obra.total_orcamento > 0 ? obra.total_orcamento : null) ??
      (obra.valor_orcado > 0 ? obra.valor_orcado : null) ??
      (orcamentoAtivo?.valor_total > 0 ? orcamentoAtivo.valor_total : null) ??
      (somaItens > 0 ? somaItens : 0);

    const resumoOrcamento = {
      hasOrcamento: !!orcamentoAtivo,
      orcamento_id: orcamentoAtivo?.id || null,
      versao: orcamentoAtivo?.versao || null,
      status: orcamentoAtivo?.status || null,
      total_orcado: valorOrcado,
      total_itens: itensOrcamento.length,
      valor_realizado: obra.valor_realizado || 0,
      percentual_consumido: valorOrcado > 0 ? ((obra.valor_realizado || 0) / valorOrcado * 100) : 0,
    };

    // 3. Cronograma
    let cronogramaItems = [];
    let marcosLegados = [];
    try {
      cronogramaItems = await base44.entities.CronogramaItem.filter({ obraId: realObraId }) || [];
    } catch (e) {
      console.warn('[getObraDetailsData] CronogramaItem filter error:', e.message);
    }
    try {
      marcosLegados = await base44.entities.MarcoObra.filter({ obra_id: realObraId }) || [];
    } catch (e) {
      console.warn('[getObraDetailsData] MarcoObra filter error:', e.message);
    }

    const totalAtividades = cronogramaItems.length > 0 ? cronogramaItems.length : marcosLegados.length;
    const atividadesConcluidas = cronogramaItems.length > 0
      ? cronogramaItems.filter(i => i.status === 'Concluído' || i.percentualConcluido >= 100).length
      : marcosLegados.filter(m => m.status === 'concluido').length;

    const progressoGeral = totalAtividades > 0
      ? Math.round((atividadesConcluidas / totalAtividades) * 100)
      : 0;

    const resumoCronograma = {
      hasData: totalAtividades > 0,
      total_atividades: totalAtividades,
      concluidas: atividadesConcluidas,
      em_andamento: cronogramaItems.length > 0
        ? cronogramaItems.filter(i => i.status === 'Em andamento').length
        : marcosLegados.filter(m => m.status === 'em_andamento').length,
      progresso_geral: progressoGeral,
      data_inicio: obra.data_inicio || null,
      data_prevista_fim: obra.data_prevista_fim || null,
    };

    // 4. Financeiro
    let contas = [];
    try {
      contas = await base44.entities.ContaFinanceira.filter({ obra_id: realObraId }) || [];
    } catch (e) {
      console.warn('[getObraDetailsData] ContaFinanceira filter error:', e.message);
    }
    const receitas = contas.filter(c => c.tipo === 'receber').reduce((a, c) => a + (c.valor || 0), 0);
    const despesas = contas.filter(c => c.tipo === 'pagar').reduce((a, c) => a + (c.valor || 0), 0);
    const receitasRecebidas = contas.filter(c => c.tipo === 'receber' && c.status === 'pago').reduce((a, c) => a + (c.valor_recebido || c.valor || 0), 0);
    const despesasPagas = contas.filter(c => c.tipo === 'pagar' && c.status === 'pago').reduce((a, c) => a + (c.valor_pago || c.valor || 0), 0);

    const resumoFinanceiro = {
      hasData: contas.length > 0,
      total_receitas: receitas,
      total_despesas: despesas,
      saldo: receitas - despesas,
      receitas_recebidas: receitasRecebidas,
      despesas_pagas: despesasPagas,
      percentual_consumido_orcamento: valorOrcado > 0 ? (despesas / valorOrcado * 100) : 0,
      qtd_contas_pagar: contas.filter(c => c.tipo === 'pagar').length,
      qtd_contas_receber: contas.filter(c => c.tipo === 'receber').length,
    };

    // 5. Suprimentos
    let requisicoes = [];
    let documentos = [];
    try {
      requisicoes = await base44.entities.RequisicaoCompra.filter({ obra_id: realObraId }) || [];
    } catch (e) {
      console.warn('[getObraDetailsData] RequisicaoCompra filter error:', e.message);
    }
    try {
      documentos = await base44.entities.AnexoObra.filter({ obra_id: realObraId }) || [];
    } catch (e) {
      console.warn('[getObraDetailsData] AnexoObra filter error:', e.message);
    }
    const contagens = {
      requisicoes: requisicoes.length,
      requisicoes_pendentes: requisicoes.filter(r => r.status === 'aguardando_aprovacao' || r.status === 'aberta').length,
      documentos: documentos.length,
    };

    return Response.json({
      obra,
      resumoOrcamento,
      resumoCronograma,
      resumoFinanceiro,
      contagens,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});