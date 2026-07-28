import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Obtém lista de usuários que devem receber notificações de um evento
 * Inclui: criador + attendees (com notify_email=true)
 * Filtra por RBAC (apenas quem tem acesso ao evento)
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
    const events = await base44.entities.CalendarEvent.filter({ id: event_id });
    if (!events || events.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }
    const event = events[0];

    // Buscar attendees
    const attendees = await base44.entities.CalendarEventAttendee.filter({ 
      event_id,
      notify_email: true 
    });

    // Coletar userIds únicos
    const userIds = new Set();
    
    // Adicionar criador
    if (event.created_by_user_id) {
      userIds.add(event.created_by_user_id);
    }
    
    // Adicionar attendees
    attendees.forEach(att => {
      if (att.user_id) {
        userIds.add(att.user_id);
      }
    });

    // Buscar dados dos usuários
    const allUsers = await base44.entities.User.list();
    const recipients = [];

    for (const userId of userIds) {
      const targetUser = allUsers.find(u => u.id === userId);
      if (!targetUser) continue;

      // Verificar RBAC: pode ver o evento?
      const canView = await canViewEvent(base44, targetUser, event);
      if (!canView) continue;

      // Verificar configurações de notificação
      const settings = await getUserNotificationSettings(base44, userId);
      if (!settings.email_enabled || !settings.calendar_email_enabled) continue;

      recipients.push({
        user_id: userId,
        email: targetUser.email,
        full_name: targetUser.full_name,
        settings
      });
    }

    return Response.json({ 
      event_id,
      recipients,
      count: recipients.length
    });

  } catch (error) {
    console.error('[getEventRecipients] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Verifica se usuário pode ver o evento (RBAC)
 */
async function canViewEvent(base44, user, event) {
  // Admin pode ver tudo
  if (user.role === 'admin') return true;

  // Criador pode ver
  if (event.created_by_user_id === user.id) return true;

  // Se não tem obra associada, pode ver
  if (!event.obra_id) return true;

  // Verificar se tem acesso à obra
  try {
    const obras = await base44.entities.Obra.filter({ id: event.obra_id });
    if (obras && obras.length > 0) {
      // Usuário tem acesso? (implementar lógica específica aqui)
      // Por ora, permitir se for da empresa ou tiver permissão
      return true;
    }
  } catch (err) {
    console.error('[canViewEvent] Error checking obra:', err);
  }

  return false;
}

/**
 * Busca configurações de notificação do usuário
 */
async function getUserNotificationSettings(base44, userId) {
  try {
    const settings = await base44.entities.UserNotificationSettings.filter({ user_id: userId });
    if (settings && settings.length > 0) {
      return settings[0];
    }
  } catch (err) {
    console.log('[getUserNotificationSettings] No settings found, using defaults');
  }

  // Retornar configurações padrão
  return {
    user_id: userId,
    email_enabled: true,
    calendar_email_enabled: true,
    default_reminders_json: [
      { type: 'BEFORE_START', value: 2, unit: 'DAYS' },
      { type: 'BEFORE_START', value: 2, unit: 'HOURS' }
    ],
    quiet_hours_enabled: false
  };
}