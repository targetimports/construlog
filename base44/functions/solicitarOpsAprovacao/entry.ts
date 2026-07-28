import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tipo, alvo, motivo } = body;

    // Validações
    if (!tipo) {
      return Response.json({ error: 'tipo is required', field: 'tipo' }, { status: 400 });
    }
    if (!alvo || typeof alvo !== 'object') {
      return Response.json({ error: 'alvo is required and must be an object', field: 'alvo' }, { status: 400 });
    }

    // Ler configurações
    const config = await base44.asServiceRole.entities.ConfiguracaoSistema.list();
    const approvals_required = parseInt(
      config.find(c => c.chave === 'ops_approvals_required')?.valor || '2'
    );
    const approval_expires_minutes = parseInt(
      config.find(c => c.chave === 'ops_approval_expires_minutes')?.valor || '30'
    );

    // Criar aprovação
    const now = new Date();
    const expires_at = new Date(now.getTime() + approval_expires_minutes * 60000);

    const aprovacao = await base44.asServiceRole.entities.OpsAprovacao.create({
      tipo,
      alvo,
      motivo,
      requested_by_email: user.email,
      status: 'pendente',
      approvals_required,
      approvers: [],
      expires_at_iso: expires_at.toISOString(),
      build_id_create: `SOLICIT-OPS-${Date.now()}`
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'SOLICITAR_OPS_APROVACAO',
        modulo: 'ops',
        entidade: 'OpsAprovacao',
        entidade_id: aprovacao.id,
        dados_novos: { tipo, alvo, approvals_required },
        sucesso: true
      });
    } catch (e) {
      // Ignorar erro de auditoria
    }

    return Response.json({
      ok: true,
      build_id: `SOLICIT-OPS-${Date.now()}`,
      aprovacao_id: aprovacao.id,
      status: 'pendente',
      expires_at_iso: expires_at.toISOString(),
      approvals_required
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});