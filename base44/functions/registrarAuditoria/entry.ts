import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função auxiliar para registrar auditorias
 * Pode ser chamada internamente por outras funções
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const {
      obra_id,
      entidade,
      entidade_id,
      acao,
      dados_antes,
      dados_depois,
      observacao,
    } = payload;

    const user = await base44.auth.me();

    if (!entidade || !entidade_id || !acao) {
      return Response.json({
        error: 'entidade, entidade_id e acao obrigatórios',
      }, { status: 400 });
    }

    const audit = await base44.asServiceRole.entities.AuditLog.create({
      obra_id,
      entidade,
      entidade_id,
      acao,
      dados_antes,
      dados_depois,
      usuario_id: user?.email || 'sistema',
      observacao,
    });

    return Response.json({ success: true, audit_id: audit.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});