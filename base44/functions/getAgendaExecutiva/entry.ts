import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
// touch: redeploy 2026-02-26 18:30:00

// FIX #3: Todas as 9 queries executadas em paralelo com Promise.all para evitar CPU time limit
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hoje = new Date();
    const hojeDia = hoje.toISOString().split('T')[0];
    const d7  = new Date(hoje.getTime() +  7 * 86400000).toISOString().split('T')[0];
    const d15 = new Date(hoje.getTime() + 15 * 86400000).toISOString().split('T')[0];
    const d30 = new Date(hoje.getTime() + 30 * 86400000).toISOString().split('T')[0];

    // Executar todas as queries em paralelo (era sequencial — causava CPU time limit)
    const [
      eventos7, eventos15, eventos30,
      contasPagar7, contasPagar15, contasPagar30,
      contasReceber7, contasReceber15, contasReceber30,
      aprovacoes7, aprovacoes15, aprovacoes30
    ] = await Promise.all([
      // Eventos agenda
      base44.asServiceRole.entities.AgendaEvento.filter({ status: 'agendado', data_inicio: { '$gte': hojeDia, '$lte': d7  } }, '-data_inicio', 30).catch(() => []),
      base44.asServiceRole.entities.AgendaEvento.filter({ status: 'agendado', data_inicio: { '$gte': hojeDia, '$lte': d15 } }, '-data_inicio', 30).catch(() => []),
      base44.asServiceRole.entities.AgendaEvento.filter({ status: 'agendado', data_inicio: { '$gte': hojeDia, '$lte': d30 } }, '-data_inicio', 30).catch(() => []),
      // Contas pagar
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'pagar', status: 'pendente', data_vencimento: { '$gte': hojeDia, '$lte': d7  } }, '-data_vencimento', 30).catch(() => []),
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'pagar', status: 'pendente', data_vencimento: { '$gte': hojeDia, '$lte': d15 } }, '-data_vencimento', 30).catch(() => []),
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'pagar', status: 'pendente', data_vencimento: { '$gte': hojeDia, '$lte': d30 } }, '-data_vencimento', 30).catch(() => []),
      // Contas receber
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'receber', status: 'pendente', data_vencimento: { '$gte': hojeDia, '$lte': d7  } }, '-data_vencimento', 30).catch(() => []),
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'receber', status: 'pendente', data_vencimento: { '$gte': hojeDia, '$lte': d15 } }, '-data_vencimento', 30).catch(() => []),
      base44.asServiceRole.entities.ContaFinanceira.filter({ tipo: 'receber', status: 'pendente', data_vencimento: { '$gte': hojeDia, '$lte': d30 } }, '-data_vencimento', 30).catch(() => []),
      // Aprovações pendentes
      base44.asServiceRole.entities.Aprovacao.filter({ status: 'pendente' }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.Aprovacao.filter({ status: 'pendente' }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.Aprovacao.filter({ status: 'pendente' }, '-created_date', 10).catch(() => []),
    ]);

    return Response.json({
      ok: true,
      hoje: hojeDia,
      blocos: {
        '7_dias': {
          eventos: eventos7,
          contas_pagar: contasPagar7,
          contas_receber: contasReceber7,
          aprovacoes: aprovacoes7,
          total: eventos7.length + contasPagar7.length + contasReceber7.length + aprovacoes7.length
        },
        '15_dias': {
          eventos: eventos15,
          contas_pagar: contasPagar15,
          contas_receber: contasReceber15,
          aprovacoes: aprovacoes15,
          total: eventos15.length + contasPagar15.length + contasReceber15.length + aprovacoes15.length
        },
        '30_dias': {
          eventos: eventos30,
          contas_pagar: contasPagar30,
          contas_receber: contasReceber30,
          aprovacoes: aprovacoes30,
          total: eventos30.length + contasPagar30.length + contasReceber30.length + aprovacoes30.length
        }
      }
    });
  } catch (error) {
    console.error('[getAgendaExecutiva] erro:', error?.message);
    return Response.json({
      ok: true,
      hoje: new Date().toISOString().split('T')[0],
      blocos: {
        '7_dias':  { eventos: [], contas_pagar: [], contas_receber: [], aprovacoes: [], total: 0 },
        '15_dias': { eventos: [], contas_pagar: [], contas_receber: [], aprovacoes: [], total: 0 },
        '30_dias': { eventos: [], contas_pagar: [], contas_receber: [], aprovacoes: [], total: 0 }
      },
      source: 'fallback_error'
    });
  }
});