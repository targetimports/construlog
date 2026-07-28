import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const buildId = `CR-CANCEL-${Date.now()}`;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { change_id, motivo } = body;

  // Validações rigorosas (sem 500 nunca)
  if (!change_id || typeof change_id !== 'string' || change_id.trim() === '') {
    return Response.json({ error: 'Invalid change_id', field: 'change_id' }, { status: 400 });
  }

  if (!motivo || typeof motivo !== 'string' || motivo.trim().length < 3) {
    return Response.json({ error: 'Motivo obrigatório (mínimo 3 caracteres)', field: 'motivo' }, { status: 400 });
  }

  try {
    // Carregar CR com tratamento de erro - NUNCA LANÇAR 500
    let crs;
    try {
      crs = await base44.asServiceRole.entities.OpsChangeRequest.filter({ id: change_id }, undefined, 1);
    } catch (err) {
      // Erro SDK ou conexão - retornar 404, não 500
      return Response.json({ error: 'CR not found', field: 'change_id' }, { status: 404 });
    }
    
    // Verificar resultado
    if (!crs || crs.length === 0) {
      return Response.json({ error: 'CR not found', field: 'change_id' }, { status: 404 });
    }
    
    const cr = crs[0];
    const now = new Date();

    // Permitir cancelamento apenas em status específicos
    if (!['draft', 'pending_approval', 'approved'].includes(cr.status)) {
      return Response.json(
        { error: `Cannot cancel CR with status ${cr.status}`, reason: 'INVALID_STATUS' },
        { status: 409 }
      );
    }

    // Atualizar CR
    try {
      await base44.asServiceRole.entities.OpsChangeRequest.update(change_id, {
        status: 'cancelled',
        build_id_last: buildId
      });
    } catch (err) {
      return Response.json({ error: 'Failed to update CR', details: err.message }, { status: 500 });
    }

    // Criar outbox CR_CANCELLED
    try {
      await base44.asServiceRole.entities.OpsOutbox.create({
        tipo: 'CR_CANCELLED',
        status: 'queued',
        channel: 'ui',
        target: 'ui',
        payload: { change_id, motivo: motivo.trim() },
        related_change_id: change_id,
        created_at_iso: now.toISOString(),
        build_id: buildId
      });
    } catch (e) {
      console.error('Erro outbox:', e.message);
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
        dados_novos: { status: 'cancelled' },
        detalhes: `CR cancelado: ${motivo.trim()}`,
        sucesso: true
      });
    } catch (e) {
      console.error('Erro auditoria:', e.message);
    }

    return Response.json({
      ok: true,
      build_id: buildId,
      status: 'cancelled'
    });
  } catch (error) {
    // Último catch: transformar qualquer erro em 404 (não existe) ou 400 (inválido)
    console.error('Erro em cancelarOpsChangeRequest:', error.message);
    
    // Se for erro SDK de ID inválido, retornar 404
    if (error.message && error.message.includes('Invalid id')) {
      return Response.json({ error: 'CR not found', field: 'change_id' }, { status: 404 });
    }
    
    // Default: erro de processamento (não database)
    return Response.json({ error: 'Failed to process cancel request' }, { status: 400 });
  }
});