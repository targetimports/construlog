import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const saldosEstoque = await base44.asServiceRole.entities.SaldoEstoque?.list?.().catch(() => []) || [];
    const contas = await base44.asServiceRole.entities.ContaFinanceira?.list?.().catch(() => []) || [];
    
    const alertas = [];
    
    // Alertas de estoque baixo
    saldosEstoque.forEach(se => {
      if (se.quantidade < se.limite_minimo) {
        alertas.push({
          tipo: 'estoque_baixo',
          material: se.material_nome,
          quantidade: se.quantidade,
          limite: se.limite_minimo
        });
      }
    });
    
    // Alertas de contas atrasadas
    const hoje = new Date();
    contas.forEach(c => {
      if (c.status === 'pendente' && new Date(c.data_vencimento) < hoje) {
        alertas.push({
          tipo: 'conta_atrasada',
          descricao: c.descricao,
          valor: c.valor,
          dias_atraso: Math.ceil((hoje - new Date(c.data_vencimento)) / (1000*60*60*24))
        });
      }
    });
    
    return Response.json({ ok: true, alertas, total: alertas.length });
  } catch (error) {
    console.error('[gerarAlertas]', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});