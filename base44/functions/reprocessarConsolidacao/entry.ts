import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { obra_id, import_run_id } = await req.json();
    if (!obra_id && !import_run_id) {
      return Response.json({ error: 'Parâmetro obrigatório: obra_id ou import_run_id' }, { status: 400 });
    }

    let registros = [];
    if (obra_id) registros = await base44.entities.OrcamentoConsolidacaoStatus.filter({ obra_id }, '-created_date', 1);
    if ((!registros || registros.length === 0) && import_run_id) {
      registros = await base44.entities.OrcamentoConsolidacaoStatus.filter({ import_run_id }, '-created_date', 1);
    }
    const atual = registros?.[0];

    if (!atual) {
      const created = await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.create({
        obra_id: obra_id || null,
        import_run_id: import_run_id || null,
        status: 'RUNNING',
        total_itens: 0,
        itens_consolidados: 0,
        itens_erro: 0,
        last_error: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      });
      return Response.json({ success: true, status_id: created.id, status: 'RUNNING' });
    }

    await base44.asServiceRole.entities.OrcamentoConsolidacaoStatus.update(atual.id, {
      status: 'RUNNING',
      last_error: null,
      itens_erro: 0,
      started_at: new Date().toISOString(),
      finished_at: null
    });

    return Response.json({ success: true, status_id: atual.id, status: 'RUNNING' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});