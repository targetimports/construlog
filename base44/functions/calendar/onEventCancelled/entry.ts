import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gatilho: evento cancelado
 * - Envia notificação imediata EVENT_CANCELLED
 * - Cancela todos os lembretes pendentes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_id } = await req.json();

    if (!event_id) {
      return Response.json({ error: 'event_id é obrigatório' }, { status: 400 });
    }

    console.log('[onEventCancelled] Processing event:', event_id);

    // Buscar evento
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }
    const event = events[0];

    // 1. Buscar recipients
    const recipientsResp = await base44.functions.invoke('calendar/getEventRecipients', { event_id });
    const recipients = recipientsResp.data.recipients || [];

    console.log('[onEventCancelled] Recipients:', recipients.length);

    // 2. Criar jobs imediatos EVENT_CANCELLED
    const immediateJobs = [];
    for (const recipient of recipients) {
      const payloadResp = await base44.functions.invoke('calendar/buildNotificationPayload', {
        event_id,
        notification_type: 'EVENT_CANCELLED',
        recipient_user_id: recipient.user_id
      });

      const jobResp = await base44.functions.invoke('calendar/queueNotificationJob', {
        company_id: event.company_id,
        user_id: recipient.user_id,
        event_id,
        type: 'EVENT_CANCELLED',
        scheduled_at_utc: new Date().toISOString(),
        payload: payloadResp.data.payload
      });

      immediateJobs.push(jobResp.data);
    }

    console.log('[onEventCancelled] Immediate jobs created:', immediateJobs.length);

    // 3. Cancelar TODOS os jobs pendentes do evento
    const pendingJobs = await base44.asServiceRole.entities.NotificationJob.filter({
      event_id,
      status: 'PENDING'
    });

    let cancelledCount = 0;
    for (const job of pendingJobs) {
      await base44.asServiceRole.entities.NotificationJob.update(job.id, {
        status: 'CANCELLED'
      });
      cancelledCount++;
    }

    console.log('[onEventCancelled] All pending jobs cancelled:', cancelledCount);

    return Response.json({ 
      success: true,
      event_id,
      immediate_jobs: immediateJobs.length,
      pending_jobs_cancelled: cancelledCount
    });

  } catch (error) {
    console.error('[onEventCancelled] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});