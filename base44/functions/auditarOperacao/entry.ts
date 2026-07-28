import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entidade, operacao, registro_id, dados_anterior, dados_novo } = await req.json();

    await base44.asServiceRole.entities.LogAuditoria?.create({
      user_email: user.email,
      entidade,
      operacao,
      registro_id,
      dados_anterior: JSON.stringify(dados_anterior),
      dados_novo: JSON.stringify(dados_novo),
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    });

    return Response.json({ sucesso: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});