import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tz, start_hhmm, end_hhmm, now_iso } = await req.json();
    
    const timezone = tz || 'America/Bahia';
    const startHhmm = start_hhmm || '22:00';
    const endHhmm = end_hhmm || '04:00';

    // Get current time in target timezone
    const now = now_iso ? new Date(now_iso) : new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const timeStr = formatter.format(now);
    const nowLocalHhmm = timeStr; // "HH:mm"
    const [hourStr, minStr] = timeStr.split(':');
    const nowMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

    // Parse window times
    const [startHour, startMin] = startHhmm.split(':').map(Number);
    const [endHour, endMin] = endHhmm.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Check if inside window
    let inside = false;
    if (startMinutes < endMinutes) {
      // Window doesn't cross midnight
      inside = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    } else {
      // Window crosses midnight (e.g., 22:00 to 04:00)
      inside = nowMinutes >= startMinutes || nowMinutes <= endMinutes;
    }

    return Response.json({
      ok: true,
      build_id: 'MAINT-WINDOW-' + Date.now(),
      inside,
      tz: timezone,
      start_hhmm: startHhmm,
      end_hhmm: endHhmm,
      now_local_hhmm: nowLocalHhmm
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});