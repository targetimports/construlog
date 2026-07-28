import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gatilho: evento atualizado
 * - Envia notificação imediata EVENT_UPDATED
 * - Cancela lembretes antigos (PENDING)
 * - Recria lembretes com nova data/hora
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

    console.log('[onEventUpdated] Processing event:', event_id);

    // Buscar evento
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }
    const event = events[0];

    // 1. Buscar recipients
    const recipientsResp = await base44.functions.invoke('calendar/getEventRecipients', { event_id });
    const recipients = recipientsResp.data.recipients || [];

    console.log('[onEventUpdated] Recipients:', recipients.length);

    // 2. Criar jobs imediatos EVENT_UPDATED
    const immediateJobs = [];
    for (const recipient of recipients) {
      const payloadResp = await base44.functions.invoke('calendar/buildNotificationPayload', {
        event_id,
        notification_type: 'EVENT_UPDATED',
        recipient_user_id: recipient.user_id
      });

      const jobResp = await base44.functions.invoke('calendar/queueNotificationJob', {
        company_id: event.company_id,
        user_id: recipient.user_id,
        event_id,
        type: 'EVENT_UPDATED',
        scheduled_at_utc: new Date().toISOString(),
        payload: payloadResp.data.payload
      });

      immediateJobs.push(jobResp.data);
    }

    console.log('[onEventUpdated] Immediate jobs created:', immediateJobs.length);

    // 3. Cancelar lembretes antigos pendentes
    const oldReminders = await base44.asServiceRole.entities.NotificationJob.filter({
      event_id,
      type: 'EVENT_REMINDER',
      status: 'PENDING'
    });

    let cancelledCount = 0;
    for (const job of oldReminders) {
      await base44.asServiceRole.entities.NotificationJob.update(job.id, {
        status: 'CANCELLED'
      });
      cancelledCount++;
    }

    console.log('[onEventUpdated] Old reminders cancelled:', cancelledCount);

    // 4. Recriar lembretes com nova data/hora
    const remindersResp = await base44.functions.invoke('calendar/scheduleEventReminders', { event_id });

    console.log('[onEventUpdated] New reminders scheduled:', remindersResp.data.reminders_scheduled);

    return Response.json({ 
      success: true,
      event_id,
      immediate_jobs: immediateJobs.length,
      old_reminders_cancelled: cancelledCount,
      new_reminders_scheduled: remindersResp.data.reminders_scheduled
    });

  } catch (error) {
    console.error('[onEventUpdated] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});