import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Cria job de notificação na fila (com idempotência)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      company_id,
      user_id, 
      event_id, 
      type, 
      scheduled_at_utc, 
      payload 
    } = await req.json();

    if (!user_id || !event_id || !type || !scheduled_at_utc || !payload) {
      return Response.json({ 
        error: 'user_id, event_id, type, scheduled_at_utc e payload são obrigatórios' 
      }, { status: 400 });
    }

    // Gerar idempotency key
    const scheduledDate = new Date(scheduled_at_utc).toISOString();
    const idempotencyKey = `${type}:${event_id}:${user_id}:${scheduledDate}`;

    // Verificar se já existe (idempotência)
    const existing = await base44.asServiceRole.entities.NotificationJob.filter({ 
      idempotency_key: idempotencyKey 
    });

    if (existing && existing.length > 0) {
      console.log('[queueNotificationJob] Job já existe (idempotente):', idempotencyKey);
      return Response.json({ 
        job_id: existing[0].id,
        status: 'already_exists',
        idempotency_key: idempotencyKey
      });
    }

    // Criar novo job
    const job = await base44.asServiceRole.entities.NotificationJob.create({
      company_id: company_id || null,
      user_id,
      channel: 'EMAIL',
      type,
      event_id,
      scheduled_at_utc,
      payload_json: payload,
      status: 'PENDING',
      attempts: 0,
      idempotency_key: idempotencyKey
    });

    console.log('[queueNotificationJob] Job criado:', job.id, idempotencyKey);

    return Response.json({ 
      job_id: job.id,
      status: 'created',
      idempotency_key: idempotencyKey
    });

  } catch (error) {
    console.error('[queueNotificationJob] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});