import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { addDays, compareAsc, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function UpcomingEvents() {
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const items = await base44.entities.CalendarEvent.list();
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60_000,
  });

  const today = new Date();
  const limit = addDays(today, 30);
  const next = (events || [])
    .filter(ev => {
      const d = parseISO(ev.start_date || ev.date || ev.created_date);
      return d >= today && d <= limit;
    })
    .sort((a, b) => compareAsc(parseISO(a.start_date || a.date || a.created_date), parseISO(b.start_date || b.date || b.created_date)))
    .slice(0, 8);

  return (
    <Card className="bg-white/90">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-purple-700">
          <Clock className="w-4 h-4" />
          <CardTitle className="text-base font-semibold">Próximos Eventos</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-slate-500">Carregando…</p>}
        {error && <p className="text-sm text-red-600">Erro ao carregar</p>}
        {!isLoading && !error && next.length === 0 && (
          <div className="text-sm text-slate-500">Nenhum evento próximo</div>
        )}
        <ul className="space-y-2">
          {next.map(ev => {
            const d = parseISO(ev.start_date || ev.date || ev.created_date);
            return (
              <li key={ev.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{ev.title || 'Evento'}</p>
                  {ev.description && (
                    <p className="text-xs text-slate-500 truncate">{ev.description}</p>
                  )}
                </div>
                <div className="text-xs text-slate-600 whitespace-nowrap">
                  {format(d, "d 'de' LLL, HH:mm", { locale: ptBR })}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}