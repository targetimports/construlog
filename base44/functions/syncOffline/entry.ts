import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { acao, dados, ultimaSincronizacao } = await req.json();

    if (acao === 'sync-down') {
      // Buscar dados para offline
      const obras = await base44.entities.Obra.list();
      const colaboradores = await base44.entities.Colaborador.list();
      const medicoes = await base44.entities.Medicao.list();

      return Response.json({
        obras,
        colaboradores,
        medicoes,
        timestamp: new Date().toISOString()
      });
    }

    if (acao === 'sync-up') {
      // Sincronizar dados criados offline
      for (const item of dados) {
        if (item.tipo === 'medicao') {
          await base44.entities.Medicao.create(item.dados);
        }
      }
      return Response.json({ sucesso: true, sincronizados: dados.length });
    }

    return Response.json({ erro: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});