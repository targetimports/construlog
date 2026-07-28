import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Worker que processa fila de notificações de calendário
 * Roda via cron a cada 5 minutos
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verificar se é chamada do cron (sem user)
    let isServiceCall = false;
    try {
      await base44.auth.me();
    } catch {
      isServiceCall = true;
    }

    console.log('[processNotificationJobs] Starting worker...');

    const now = new Date();
    const nowIso = now.toISOString();

    // Buscar jobs pendentes que devem ser enviados agora
    const allJobs = await base44.asServiceRole.entities.NotificationJob.list('-scheduled_at_utc', 100);
    
    const pendingJobs = allJobs.filter(job => 
      job.status === 'PENDING' && 
      new Date(job.scheduled_at_utc) <= now
    ).slice(0, 50); // Limitar a 50 por execução

    console.log('[processNotificationJobs] Found pending jobs:', pendingJobs.length);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      retried: 0,
      cancelled: 0
    };

    // Processar cada job
    for (const job of pendingJobs) {
      try {
        results.processed++;

        // 1. Verificar se evento ainda existe e está ativo
        const events = await base44.asServiceRole.entities.CalendarEvent.filter({ id: job.event_id });
        if (!events || events.length === 0) {
          console.log(`[processNotificationJobs] Event ${job.event_id} not found - cancelling job`);
          await base44.asServiceRole.entities.NotificationJob.update(job.id, {
            status: 'CANCELLED',
            last_error: 'Evento não encontrado'
          });
          results.cancelled++;
          continue;
        }

        const event = events[0];
        if (event.status === 'CANCELLED') {
          console.log(`[processNotificationJobs] Event ${job.event_id} cancelled - cancelling job`);
          await base44.asServiceRole.entities.NotificationJob.update(job.id, {
            status: 'CANCELLED',
            last_error: 'Evento cancelado'
          });
          results.cancelled++;
          continue;
        }

        // 2. Buscar usuário destinatário
        const users = await base44.asServiceRole.entities.User.filter({ id: job.user_id });
        if (!users || users.length === 0) {
          console.log(`[processNotificationJobs] User ${job.user_id} not found - cancelling job`);
          await base44.asServiceRole.entities.NotificationJob.update(job.id, {
            status: 'CANCELLED',
            last_error: 'Usuário não encontrado'
          });
          results.cancelled++;
          continue;
        }

        const user = users[0];

        // 3. Verificar RBAC (usuário ainda tem permissão?)
        const hasPermission = await checkUserPermission(base44, user, event);
        if (!hasPermission) {
          console.log(`[processNotificationJobs] User ${job.user_id} no permission - cancelling job`);
          await base44.asServiceRole.entities.NotificationJob.update(job.id, {
            status: 'CANCELLED',
            last_error: 'Usuário sem permissão para ver evento'
          });
          results.cancelled++;
          continue;
        }

        // 4. Tentar enviar e-mail
        try {
          const sendResp = await base44.asServiceRole.functions.invoke('calendar/sendCalendarEmail', {
            to: user.email,
            subject: job.payload_json.subject,
            payload: job.payload_json
          });

          if (sendResp.data?.success) {
            // Sucesso
            await base44.asServiceRole.entities.NotificationJob.update(job.id, {
              status: 'SENT',
              attempts: (job.attempts || 0) + 1
            });
            results.sent++;
            console.log(`[processNotificationJobs] Email sent to ${user.email} for event ${job.event_id}`);
          } else {
            throw new Error(sendResp.data?.error || 'Erro ao enviar e-mail');
          }

        } catch (sendError) {
          // Erro no envio
          const attempts = (job.attempts || 0) + 1;
          const errorMsg = sendError.message || 'Erro desconhecido ao enviar e-mail';

          console.error(`[processNotificationJobs] Send error (attempt ${attempts}):`, errorMsg);

          if (attempts >= 5) {
            // Falhou após 5 tentativas - marcar como FAILED
            await base44.asServiceRole.entities.NotificationJob.update(job.id, {
              status: 'FAILED',
              attempts,
              last_error: errorMsg
            });
            results.failed++;
            console.log(`[processNotificationJobs] Job ${job.id} failed after ${attempts} attempts`);
          } else {
            // Reagendar com backoff exponencial
            const backoffMinutes = getBackoffMinutes(attempts);
            const nextSchedule = new Date(now.getTime() + backoffMinutes * 60 * 1000);

            await base44.asServiceRole.entities.NotificationJob.update(job.id, {
              status: 'PENDING',
              attempts,
              last_error: errorMsg,
              scheduled_at_utc: nextSchedule.toISOString()
            });
            results.retried++;
            console.log(`[processNotificationJobs] Job ${job.id} rescheduled to ${nextSchedule.toISOString()} (backoff: ${backoffMinutes}min)`);
          }
        }

      } catch (jobError) {
        console.error(`[processNotificationJobs] Error processing job ${job.id}:`, jobError);
        // Continuar processando outros jobs
      }
    }

    console.log('[processNotificationJobs] Worker finished:', results);

    return Response.json({ 
      success: true,
      timestamp: nowIso,
      ...results
    });

  } catch (error) {
    console.error('[processNotificationJobs] Worker error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Backoff exponencial: 2min, 10min, 30min, 2h, 12h
 */
function getBackoffMinutes(attempts) {
  const backoffs = [2, 10, 30, 120, 720];
  return backoffs[Math.min(attempts - 1, backoffs.length - 1)];
}

/**
 * Verifica se usuário ainda tem permissão para ver evento
 */
async function checkUserPermission(base44, user, event) {
  // Admin sempre tem permissão
  if (user.role === 'admin') return true;

  // Criador sempre tem permissão
  if (event.created_by_user_id === user.id) return true;

  // Verificar se está nos attendees
  try {
    const attendees = await base44.asServiceRole.entities.CalendarEventAttendee.filter({
      event_id: event.id,
      user_id: user.id
    });
    if (attendees && attendees.length > 0) return true;
  } catch (err) {
    console.error('[checkUserPermission] Error checking attendees:', err);
  }

  // Se não tem obra, permite
  if (!event.obra_id) return true;

  // Por padrão, permitir (implementar lógica específica aqui se necessário)
  return true;
}