import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `CR-APPROVE-${Date.now()}`;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { change_id, decisao, motivo } = body;

    if (!change_id) {
      return Response.json({ error: 'Missing change_id', field: 'change_id' }, { status: 400 });
    }
    if (!decisao || !['aprovar', 'rejeitar'].includes(decisao)) {
      return Response.json({ error: 'Invalid decisao', field: 'decisao' }, { status: 400 });
    }

    // Carregar CR
    const crs = await base44.asServiceRole.entities.OpsChangeRequest.filter({ id: change_id }, undefined, 1);
    if (!crs || crs.length === 0) {
      return Response.json({ error: 'CR not found' }, { status: 404 });
    }

    const cr = crs[0];
    const now = new Date();

    // Bloquear se status inválido
    if (['success', 'failed', 'cancelled', 'expired'].includes(cr.status)) {
      return Response.json(
        { error: `Cannot approve CR with status ${cr.status}`, reason: 'INVALID_STATUS' },
        { status: 409 }
      );
    }

    // Verificar expiração
    const expiresAt = new Date(cr.expires_at_iso);
    if (now > expiresAt) {
      await base44.asServiceRole.entities.OpsChangeRequest.update(change_id, {
        status: 'expired',
        build_id_last: buildId
      });
      return Response.json(
        { error: 'CR expired', reason: 'EXPIRED' },
        { status: 409 }
      );
    }

    let newStatus = cr.status;
    let approved_by = cr.approved_by || [];
    let isIdempotent = false;

    if (decisao === 'rejeitar') {
      newStatus = 'cancelled';
      
      // Criar outbox CR_CANCELLED
      try {
        await base44.asServiceRole.entities.OpsOutbox.create({
          tipo: 'CR_CANCELLED',
          status: 'queued',
          channel: 'ui',
          target: 'ui',
          payload: { change_id, motivo: motivo || 'Rejeitado' },
          related_change_id: change_id,
          created_at_iso: now.toISOString(),
          build_id: buildId
        });
      } catch (e) {
        console.error('Erro outbox:', e.message);
      }
    } else {
      // aprovar - IDEMPOTENTE: mesma pessoa não incrementa count
      const alreadyApproved = approved_by.find(a => a.email === user.email);
      
      if (alreadyApproved) {
        // Já aprovou - idempotente
        isIdempotent = true;
      } else {
        // Primeira aprovação desta pessoa
        approved_by.push({
          email: user.email,
          approved_at_iso: now.toISOString()
        });

        if (approved_by.length >= cr.approvals_required) {
          newStatus = 'approved';
          
          // Criar outbox CR_APPROVED
          try {
            await base44.asServiceRole.entities.OpsOutbox.create({
              tipo: 'CR_APPROVED',
              status: 'queued',
              channel: 'ui',
              target: 'ui',
              payload: { change_id, approved_count: approved_by.length },
              related_change_id: change_id,
              created_at_iso: now.toISOString(),
              build_id: buildId
            });
          } catch (e) {
            console.error('Erro outbox:', e.message);
          }
        }
      }
    }

    // Atualizar CR (mesmo em idempotente, confirmar approved_by está correto)
    if (decisao === 'rejeitar' || !isIdempotent) {
      await base44.asServiceRole.entities.OpsChangeRequest.update(change_id, {
        status: newStatus,
        approved_by: decisao === 'rejeitar' ? cr.approved_by : approved_by,
        approved_at_iso: decisao === 'aprovar' ? now.toISOString() : cr.approved_at_iso,
        build_id_last: buildId
      });
    }

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'UPDATE',
        modulo: 'ops',
        entidade: 'OpsChangeRequest',
        entidade_id: change_id,
        dados_anteriores: { status: cr.status },
        dados_novos: { status: newStatus, decisao, idempotent: isIdempotent },
        detalhes: `CR ${decisao === 'aprovar' ? 'aprovado' : 'rejeitado'}${isIdempotent ? ' (idempotente)' : ''}`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      status: newStatus,
      approved_count: approved_by.length,
      approvals_required: cr.approvals_required,
      idempotent: isIdempotent
    });
  } catch (error) {
    console.error('Erro em aprovarOpsChangeRequest:', error.message);
    return Response.json({ error: error.message, build_id: buildId }, { status: 500 });
  }
});