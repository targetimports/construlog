import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { local_estoque_id } = await req.json();
    if (!local_estoque_id) return Response.json({ error: 'local_estoque_id obrigatório' }, { status: 400 });

    const movs = await base44.asServiceRole.entities.EstoqueMovimentacao.list('-data_mov', 5000);

    // Calcular saldo por material no local
    const saldos = {};
    for (const m of movs) {
      if (m.tipo === 'ENTRADA' && m.destino_local_id === local_estoque_id) {
        saldos[m.material_id] = (saldos[m.material_id] || 0) + (m.quantidade || 0);
      }
      if (m.tipo === 'SAIDA' && m.origem_local_id === local_estoque_id) {
        saldos[m.material_id] = (saldos[m.material_id] || 0) - (m.quantidade || 0);
      }
      if (m.tipo === 'TRANSFERENCIA') {
        if (m.origem_local_id === local_estoque_id) saldos[m.material_id] = (saldos[m.material_id] || 0) - (m.quantidade || 0);
        if (m.destino_local_id === local_estoque_id) saldos[m.material_id] = (saldos[m.material_id] || 0) + (m.quantidade || 0);
      }
      if (m.tipo === 'AJUSTE') {
        if (m.destino_local_id === local_estoque_id) saldos[m.material_id] = (saldos[m.material_id] || 0) + (m.quantidade || 0);
        if (m.origem_local_id === local_estoque_id) saldos[m.material_id] = (saldos[m.material_id] || 0) - (m.quantidade || 0);
      }
    }

    return Response.json({ saldos });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});