import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, tipo, limit = 30, skip = 0 } = body;

    // Construir filtro
    const filter = {};
    if (status) filter.status = status;
    if (tipo) filter.tipo = tipo;

    // Listar
    const aprovacoes = await base44.asServiceRole.entities.OpsAprovacao.filter(filter, '-created_date', limit, skip);

    // Marcar como expiradas se aplicável
    const now = new Date();
    const withExpired = aprovacoes.map(a => {
      const isExpired = a.status === 'pendente' && new Date(a.expires_at_iso) < now;
      return {
        ...a,
        expired: isExpired
      };
    });

    // Total count
    const allAprovacoes = await base44.asServiceRole.entities.OpsAprovacao.filter(filter);
    const totalCount = allAprovacoes.length;

    return Response.json({
      ok: true,
      build_id: `LIST-OPS-APROV-${Date.now()}`,
      aprovacoes: withExpired,
      total: totalCount,
      limit,
      skip,
      count: withExpired.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});