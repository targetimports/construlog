import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `CR-CREATE-${Date.now()}`;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { tipo, ambiente, descricao, motivo, snapshot_id, rollback_job_id } = body;

    // Validação de campos obrigatórios
    if (!tipo || !['RESTORE_PROD', 'ROLLBACK_PROD', 'RESTORE_STAGING', 'ROLLBACK_STAGING', 'MAINTENANCE_CHANGE'].includes(tipo)) {
      return Response.json({ error: 'Missing or invalid tipo', field: 'tipo' }, { status: 400 });
    }
    if (!ambiente || !['production', 'staging'].includes(ambiente)) {
      return Response.json({ error: 'Missing or invalid ambiente', field: 'ambiente' }, { status: 400 });
    }
    if (!descricao) {
      return Response.json({ error: 'Missing descricao', field: 'descricao' }, { status: 400 });
    }
    if (!motivo) {
      return Response.json({ error: 'Missing motivo', field: 'motivo' }, { status: 400 });
    }

    const now = new Date();

    // Ler configurações
    const cfgs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({}, undefined, 100);
    const configMap = {};
    if (cfgs && Array.isArray(cfgs)) {
      cfgs.forEach(c => { configMap[c.chave] = c.valor; });
    }
    const approvals_required = parseInt(configMap['ops_approvals_required'] || '2');
    const expires_minutes = parseInt(configMap['ops_change_expires_minutes'] || '60');

    const expires_at = new Date(now.getTime() + expires_minutes * 60 * 1000);

    // Criar CR
    const cr = await base44.asServiceRole.entities.OpsChangeRequest.create({
      tipo,
      ambiente,
      status: 'pending_approval',
      descricao,
      motivo,
      requested_by: user.email,
      requested_at_iso: now.toISOString(),
      approvals_required,
      approved_by: [],
      expires_at_iso: expires_at.toISOString(),
      snapshot_id: snapshot_id || undefined,
      rollback_job_id: rollback_job_id || undefined,
      build_id_create: buildId,
      build_id_last: buildId
    });

    // Criar outbox para CR_CREATED
    try {
      await base44.asServiceRole.entities.OpsOutbox.create({
        tipo: 'CR_CREATED',
        status: 'queued',
        channel: 'ui',
        target: 'ui',
        payload: {
          change_id: cr.id,
          tipo,
          ambiente,
          requested_by: user.email
        },
        related_change_id: cr.id,
        created_at_iso: now.toISOString(),
        build_id: buildId
      });
    } catch (e) {
      console.error('Erro ao criar outbox:', e.message);
    }

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'CREATE',
        modulo: 'ops',
        entidade: 'OpsChangeRequest',
        entidade_id: cr.id,
        dados_novos: { tipo, ambiente, status: 'pending_approval' },
        detalhes: `CR criado: ${tipo} em ${ambiente}`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      change_id: cr.id,
      status: 'pending_approval',
      approvals_required,
      expires_at_iso: expires_at.toISOString()
    });
  } catch (error) {
    console.error('Erro em criarOpsChangeRequest:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});