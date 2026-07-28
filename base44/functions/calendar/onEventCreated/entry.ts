import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gatilho: evento criado
 * - Envia notificação imediata EVENT_CREATED
 * - Agenda lembretes
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

    console.log('[onEventCreated] Processing event:', event_id);

    // Buscar evento
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }
    const event = events[0];

    // 1. Buscar recipients
    const recipientsResp = await base44.functions.invoke('calendar/getEventRecipients', { event_id });
    const recipients = recipientsResp.data.recipients || [];

    console.log('[onEventCreated] Recipients:', recipients.length);

    // 2. Criar jobs imediatos EVENT_CREATED
    const immediateJobs = [];
    for (const recipient of recipients) {
      const payloadResp = await base44.functions.invoke('calendar/buildNotificationPayload', {
        event_id,
        notification_type: 'EVENT_CREATED',
        recipient_user_id: recipient.user_id
      });

      const jobResp = await base44.functions.invoke('calendar/queueNotificationJob', {
        company_id: event.company_id,
        user_id: recipient.user_id,
        event_id,
        type: 'EVENT_CREATED',
        scheduled_at_utc: new Date().toISOString(),
        payload: payloadResp.data.payload
      });

      immediateJobs.push(jobResp.data);
    }

    console.log('[onEventCreated] Immediate jobs created:', immediateJobs.length);

    // 3. Agendar lembretes
    const remindersResp = await base44.functions.invoke('calendar/scheduleEventReminders', { event_id });

    console.log('[onEventCreated] Reminders scheduled:', remindersResp.data.reminders_scheduled);

    return Response.json({ 
      success: true,
      event_id,
      immediate_jobs: immediateJobs.length,
      reminders_scheduled: remindersResp.data.reminders_scheduled
    });

  } catch (error) {
    console.error('[onEventCreated] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});