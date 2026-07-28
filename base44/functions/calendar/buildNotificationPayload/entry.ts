import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Constrói payload do e-mail de notificação de calendário
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event_id, notification_type, recipient_user_id } = await req.json();

    if (!event_id || !notification_type) {
      return Response.json({ error: 'event_id e notification_type são obrigatórios' }, { status: 400 });
    }

    // Buscar evento
    const events = await base44.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }
    const event = events[0];

    // Buscar obra se houver
    let obraName = null;
    if (event.obra_id) {
      try {
        const obras = await base44.entities.Obra.filter({ id: event.obra_id });
        if (obras && obras.length > 0) {
          obraName = obras[0].nome;
        }
      } catch (err) {
        console.error('[buildPayload] Error fetching obra:', err);
      }
    }

    // Formatar datas no timezone do evento
    const timezone = event.timezone || 'America/Sao_Paulo';
    const startAt = new Date(event.start_at_utc);
    const endAt = new Date(event.end_at_utc);

    const formatDate = (date) => {
      return date.toLocaleString('pt-BR', { 
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'short'
      });
    };

    // Construir subject baseado no tipo
    let subject = '';
    switch (notification_type) {
      case 'EVENT_CREATED':
        subject = `📅 Novo agendamento: ${event.title}`;
        break;
      case 'EVENT_UPDATED':
        subject = `🔄 Agendamento atualizado: ${event.title}`;
        break;
      case 'EVENT_CANCELLED':
        subject = `❌ Agendamento cancelado: ${event.title}`;
        break;
      case 'EVENT_REMINDER':
        subject = `⏰ Lembrete: ${event.title}`;
        break;
      default:
        subject = `Calendário: ${event.title}`;
    }

    // Construir link do evento
    const appUrl = Deno.env.get('APP_URL') || 'https://app.base44.com';
    const eventLink = `${appUrl}/Agenda?event=${event_id}`;

    // Payload completo
    const payload = {
      subject,
      summary: buildSummary(notification_type, event),
      event_title: event.title,
      event_description: event.description || '',
      event_location: event.location || '',
      event_start: formatDate(startAt),
      event_end: formatDate(endAt),
      event_start_utc: event.start_at_utc,
      event_end_utc: event.end_at_utc,
      obra_name: obraName,
      timezone: timezone,
      link: eventLink,
      notification_type
    };

    return Response.json({ payload });

  } catch (error) {
    console.error('[buildNotificationPayload] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Constrói resumo do e-mail
 */
function buildSummary(type, event) {
  switch (type) {
    case 'EVENT_CREATED':
      return `Um novo evento foi adicionado ao seu calendário: "${event.title}".`;
    case 'EVENT_UPDATED':
      return `O evento "${event.title}" foi atualizado no calendário.`;
    case 'EVENT_CANCELLED':
      return `O evento "${event.title}" foi cancelado.`;
    case 'EVENT_REMINDER':
      return `Lembrete: o evento "${event.title}" está se aproximando.`;
    default:
      return `Notificação sobre o evento: "${event.title}".`;
  }
}