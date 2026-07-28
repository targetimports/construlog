import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * recalcularResumoObra
 * Lê dados de Orcamento/OrcamentoItem/CronogramaItem via service role
 * e salva valor_orcado, total_orcamento na própria Obra.
 * Resolve o RLS gap: a Obra é acessível ao usuário e carrega o resumo.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const obraId = payload.obra_id;

    if (!obraId) {
      return Response.json({ error: 'obra_id é obrigatória' }, { status: 400 });
    }

    // Buscar orçamento via service role (evita RLS)
    const orcamentos = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId });
    const orcAtivo = orcamentos[0] || null;

    // Buscar itens via service role
    const itens = await base44.asServiceRole.entities.OrcamentoItem.filter({ obra_id: obraId });

    // Calcular total a partir dos grupos raiz
    const somaGrupos = itens
      .filter(i => i.is_grupo)
      .reduce((s, i) => s + (i.total || 0), 0);

    // Resolver valor orçado com fallbacks
    const valorOrcado =
      somaGrupos ||
      orcAtivo?.total ||
      orcAtivo?.valor_total ||
      0;

    // Buscar dados financeiros (contas pagar vinculadas)
    let valorRealizado = 0;
    try {
      const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({ obra_id: obraId });
      valorRealizado = contas
        .filter(c => c.tipo === 'pagar')
        .reduce((s, c) => s + (c.valor || 0), 0);
    } catch(e) {}

    const percentConsumo = valorOrcado > 0
      ? Math.round((valorRealizado / valorOrcado) * 10000) / 100
      : 0;

    // Atualizar a Obra com o resumo (campos que a UI lê)
    await base44.asServiceRole.entities.Obra.update(obraId, {
      total_orcamento: valorOrcado,
      valor_orcado: valorOrcado,
      valor_realizado: valorRealizado,
      percent_consumido: percentConsumo,
      resumo_atualizado_em: new Date().toISOString(),
    });

    // Também atualizar campo valor_total no Orcamento (SecaoOrcamento lê valor_total)
    if (orcAtivo && (orcAtivo.valor_total !== valorOrcado || orcAtivo.total !== valorOrcado)) {
      try {
        await base44.asServiceRole.entities.Orcamento.update(orcAtivo.id, {
          total: valorOrcado,
          valor_total: valorOrcado,
        });
      } catch(e) {
        console.warn('⚠️ Não foi possível atualizar Orcamento.valor_total:', e.message);
      }
    }

    console.log(`✅ Resumo recalculado para obra ${obraId}: orçado=${valorOrcado}, realizado=${valorRealizado}`);

    return Response.json({
      obraId,
      valor_orcado: valorOrcado,
      valor_realizado: valorRealizado,
      percent_consumido: percentConsumo,
      orcamento_itens: itens.length,
      message: `✅ Resumo recalculado: orçado=${valorOrcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    });

  } catch (error) {
    console.error('❌ Erro ao recalcular resumo:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});