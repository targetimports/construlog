import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { aprovacao_id, decisao, motivo } = body;

    if (!aprovacao_id) {
      return Response.json({ error: 'aprovacao_id is required', field: 'aprovacao_id' }, { status: 400 });
    }
    if (!decisao || !['aprovar', 'rejeitar'].includes(decisao)) {
      return Response.json({ error: 'decisao must be "aprovar" or "rejeitar"', field: 'decisao' }, { status: 400 });
    }

    // Buscar aprovação
    const aprovacoes = await base44.asServiceRole.entities.OpsAprovacao.filter({ id: aprovacao_id });
    if (!aprovacoes || aprovacoes.length === 0) {
      return Response.json({ error: 'OpsAprovacao not found' }, { status: 404 });
    }

    const aprovacao = aprovacoes[0];

    // Validação 1: Não pode self-approve
    if (aprovacao.requested_by_email === user.email) {
      return Response.json(
        { error: 'Self approval not allowed', reason: 'SELF_APPROVAL_NOT_ALLOWED' },
        { status: 403 }
      );
    }

    // Validação 2: Não pode aprovar 2x
    const alreadyApproved = aprovacao.approvers?.some(a => a.user_email === user.email);
    if (alreadyApproved) {
      return Response.json(
        { error: 'User already approved this', reason: 'ALREADY_APPROVED' },
        { status: 403 }
      );
    }

    // Validação 3: Expiração
    if (aprovacao.status === 'pendente') {
      const now = new Date();
      const expires = new Date(aprovacao.expires_at_iso);
      if (now > expires) {
        await base44.asServiceRole.entities.OpsAprovacao.update(aprovacao.id, { status: 'expirada' });
        return Response.json({ error: 'OpsAprovacao expired', reason: 'EXPIRED' }, { status: 403 });
      }
    }

    // Se rejeitar
    if (decisao === 'rejeitar') {
      const now = new Date();
      await base44.asServiceRole.entities.OpsAprovacao.update(aprovacao.id, {
        status: 'rejeitada',
        rejected_by: {
          user_email: user.email,
          rejected_at_iso: now.toISOString(),
          motivo: motivo || ''
        }
      });

      try {
        await base44.asServiceRole.entities.LogAuditoria.create({
          user_email: user.email,
          acao: 'REJEITAR_OPS_APROVACAO',
          modulo: 'ops',
          entidade: 'OpsAprovacao',
          entidade_id: aprovacao.id,
          detalhes: { decisao: 'rejeitar', motivo },
          sucesso: true
        });
      } catch (e) {
        // Ignorar
      }

      return Response.json({
        ok: true,
        build_id: `DECIDE-OPS-${Date.now()}`,
        status: 'rejeitada',
        approvers_count: aprovacao.approvers?.length || 0,
        approvals_required: aprovacao.approvals_required
      });
    }

    // Se aprovar
    const now = new Date();
    const novoApprover = {
      user_email: user.email,
      approved_at_iso: now.toISOString()
    };
    const novosApprovers = [...(aprovacao.approvers || []), novoApprover];

    let novoStatus = 'pendente';
    let approved_at_iso = null;

    if (novosApprovers.length >= aprovacao.approvals_required) {
      novoStatus = 'aprovada';
      approved_at_iso = now.toISOString();
    }

    const updateData = {
      approvers: novosApprovers,
      status: novoStatus
    };

    if (approved_at_iso) {
      updateData.approved_at_iso = approved_at_iso;
    }

    await base44.asServiceRole.entities.OpsAprovacao.update(aprovacao.id, updateData);

    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'APROVAR_OPS_APROVACAO',
        modulo: 'ops',
        entidade: 'OpsAprovacao',
        entidade_id: aprovacao.id,
        detalhes: { decisao: 'aprovar', novo_status: novoStatus },
        sucesso: true
      });
    } catch (e) {
      // Ignorar
    }

    return Response.json({
      ok: true,
      build_id: `DECIDE-OPS-${Date.now()}`,
      status: novoStatus,
      approvers_count: novosApprovers.length,
      approvals_required: aprovacao.approvals_required
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});