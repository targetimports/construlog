import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // ── VISÃO SERVICE (admin) ──────────────────────────────────────────
    let obraService = null;
    let orcamentosService = [];
    let orcamentoItensService = [];
    let cronogramaItensService = [];

    try { const r = await base44.asServiceRole.entities.Obra.filter({ id: obraId }); obraService = r?.[0] || null; } catch(e) {}
    try { orcamentosService = await base44.asServiceRole.entities.Orcamento.filter({ obra_id: obraId }); } catch(e) {}
    try { orcamentoItensService = await base44.asServiceRole.entities.OrcamentoItem.filter({ obra_id: obraId }); } catch(e) {}
    try { cronogramaItensService = await base44.asServiceRole.entities.CronogramaItem.filter({ obraId: obraId }); } catch(e) {}

    // ── VISÃO USER (contexto real) ─────────────────────────────────────
    let obraUser = null;
    let orcamentosUser = [];
    let orcamentoItensUser = [];
    let cronogramaItensUser = [];

    try { const r = await base44.entities.Obra.filter({ id: obraId }); obraUser = r?.[0] || null; } catch(e) {}
    try { orcamentosUser = await base44.entities.Orcamento.filter({ obra_id: obraId }); } catch(e) {}
    try { orcamentoItensUser = await base44.entities.OrcamentoItem.filter({ obra_id: obraId }); } catch(e) {}
    try { cronogramaItensUser = await base44.entities.CronogramaItem.filter({ obraId: obraId }); } catch(e) {}

    // ── RESOLVER valor orçado ──────────────────────────────────────────
    const orcAtivo = orcamentosService[0];
    const somaItens = orcamentoItensService
      .filter(i => i.is_grupo)
      .reduce((s, i) => s + (i.total || 0), 0);

    const valorOrcadoResolvido =
      obraService?.valor_orcado ||
      obraService?.total_orcamento ||
      orcAtivo?.total ||
      orcAtivo?.valor_total ||
      somaItens ||
      0;

    // ── RLS gap ────────────────────────────────────────────────────────
    const rlsGap = {
      obra: !!obraService && !obraUser,
      orcamento: orcamentosService.length > 0 && orcamentosUser.length === 0,
      orcamento_itens: orcamentoItensService.length > 0 && orcamentoItensUser.length === 0,
      cronograma: cronogramaItensService.length > 0 && cronogramaItensUser.length === 0,
    };
    const temRlsProblem = Object.values(rlsGap).some(Boolean);

    const diagnostico = {
      user: { id: user.id, email: user.email, role: user.role },
      counts_service: {
        orcamentos: orcamentosService.length,
        orcamento_itens: orcamentoItensService.length,
        cronograma_itens: cronogramaItensService.length,
      },
      counts_user: {
        orcamentos: orcamentosUser.length,
        orcamento_itens: orcamentoItensUser.length,
        cronograma_itens: cronogramaItensUser.length,
      },
      rls_gap: rlsGap,
      tem_rls_problem: temRlsProblem,
      obra_service: obraService ? {
        id: obraService.id,
        nome: obraService.nome,
        created_by: obraService.created_by,
        total_orcamento: obraService.total_orcamento,
        valor_orcado: obraService.valor_orcado,
        importada_orca_facil: obraService.importada_orca_facil,
      } : null,
      orcamento_service: orcAtivo ? {
        id: orcAtivo.id,
        obra_id: orcAtivo.obra_id,
        created_by: orcAtivo.created_by,
        total: orcAtivo.total,
        valor_total: orcAtivo.valor_total,
      } : null,
      soma_itens_grupos: somaItens,
      valor_orcado_resolvido: valorOrcadoResolvido,
      diagnostico: temRlsProblem
        ? '❌ RLS/TENANT: dados existem no service role mas não no user scope. Executar recalcularResumoObra para copiar valor para a Obra.'
        : valorOrcadoResolvido === 0
          ? '⚠️ Dados OK mas valor orçado = 0. Verificar campo total nas entidades.'
          : '✅ Tudo parece OK',
    };

    console.log('📊 DIAGNÓSTICO DUPLO:', JSON.stringify(diagnostico, null, 2));
    return Response.json(diagnostico);

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});