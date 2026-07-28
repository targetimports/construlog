import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Agenda lembretes para um evento
 * Considera: reminders padrão do usuário, overrides do evento, quiet hours
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

    // Buscar evento
    const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }
    const event = events[0];

    // Buscar recipients
    const recipientsResp = await base44.functions.invoke('calendar/getEventRecipients', { event_id });
    const recipients = recipientsResp.data.recipients || [];

    // Buscar override de lembretes (se existir)
    let eventRemindersOverride = null;
    try {
      const overrides = await base44.asServiceRole.entities.CalendarEventReminderOverride.filter({ event_id });
      if (overrides && overrides.length > 0 && overrides[0].enabled) {
        eventRemindersOverride = overrides[0].reminders_json;
      }
    } catch (err) {
      console.log('[scheduleEventReminders] No override found');
    }

    const jobsCreated = [];
    const timezone = event.timezone || 'America/Sao_Paulo';
    const eventStartUtc = new Date(event.start_at_utc);

    // Para cada recipient
    for (const recipient of recipients) {
      // Decidir quais reminders usar
      let reminders = eventRemindersOverride || recipient.settings.default_reminders_json || [];

      // Para cada reminder
      for (const reminder of reminders) {
        let scheduledAtUtc = calculateReminderTime(eventStartUtc, reminder);

        // Aplicar quiet hours se habilitado
        if (recipient.settings.quiet_hours_enabled) {
          scheduledAtUtc = adjustForQuietHours(
            scheduledAtUtc,
            recipient.settings.quiet_start,
            recipient.settings.quiet_end,
            timezone
          );
        }

        // Construir payload
        const payloadResp = await base44.functions.invoke('calendar/buildNotificationPayload', {
          event_id,
          notification_type: 'EVENT_REMINDER',
          recipient_user_id: recipient.user_id
        });
        const payload = payloadResp.data.payload;

        // Criar job
        const jobResp = await base44.functions.invoke('calendar/queueNotificationJob', {
          company_id: event.company_id,
          user_id: recipient.user_id,
          event_id,
          type: 'EVENT_REMINDER',
          scheduled_at_utc: scheduledAtUtc.toISOString(),
          payload
        });

        jobsCreated.push(jobResp.data);
      }
    }

    return Response.json({ 
      event_id,
      reminders_scheduled: jobsCreated.length,
      jobs: jobsCreated
    });

  } catch (error) {
    console.error('[scheduleEventReminders] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Calcula horário do lembrete
 */
function calculateReminderTime(eventStartUtc, reminder) {
  const { type, value, unit } = reminder;

  if (type === 'AT_TIME') {
    return eventStartUtc;
  }

  // BEFORE_START
  let offsetMs = 0;
  switch (unit) {
    case 'MINUTES':
      offsetMs = value * 60 * 1000;
      break;
    case 'HOURS':
      offsetMs = value * 60 * 60 * 1000;
      break;
    case 'DAYS':
      offsetMs = value * 24 * 60 * 60 * 1000;
      break;
  }

  return new Date(eventStartUtc.getTime() - offsetMs);
}

/**
 * Ajusta horário para respeitar quiet hours
 */
function adjustForQuietHours(scheduledAt, quietStart, quietEnd, timezone) {
  if (!quietStart || !quietEnd) return scheduledAt;

  try {
    // Converter para o timezone do evento
    const timeStr = scheduledAt.toLocaleTimeString('en-GB', { 
      timeZone: timezone, 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const [hour, minute] = timeStr.split(':').map(Number);
    const [qStartH, qStartM] = quietStart.split(':').map(Number);
    const [qEndH, qEndM] = quietEnd.split(':').map(Number);

    const currentMinutes = hour * 60 + minute;
    const quietStartMinutes = qStartH * 60 + qStartM;
    const quietEndMinutes = qEndH * 60 + qEndM;

    // Está dentro do horário silencioso?
    let inQuietHours = false;
    if (quietStartMinutes < quietEndMinutes) {
      // Normal: 22:00 - 07:00 do dia seguinte
      inQuietHours = currentMinutes >= quietStartMinutes || currentMinutes < quietEndMinutes;
    } else {
      // Atravessa meia-noite: 22:00 - 07:00
      inQuietHours = currentMinutes >= quietStartMinutes && currentMinutes < quietEndMinutes;
    }

    if (inQuietHours) {
      // Empurrar para o fim do quiet hours
      const offsetMinutes = quietEndMinutes - currentMinutes;
      if (offsetMinutes < 0) {
        // Próximo dia
        return new Date(scheduledAt.getTime() + (24 * 60 + offsetMinutes) * 60 * 1000);
      } else {
        return new Date(scheduledAt.getTime() + offsetMinutes * 60 * 1000);
      }
    }

    return scheduledAt;
  } catch (err) {
    console.error('[adjustForQuietHours] Error:', err);
    return scheduledAt;
  }
}