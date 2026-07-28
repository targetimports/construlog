import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getMonthGrid(date) {
  const startMonth = startOfMonth(date);
  const endMonthDate = endOfMonth(date);
  const startDate = startOfWeek(startMonth, { weekStartsOn: 0 });
  const endDate = endOfWeek(endMonthDate, { weekStartsOn: 0 });

  const days = [];
  let current = startDate;
  while (current <= endDate) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

function useCalendarEvents() {
  return useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      // Buscar todos e filtrar no cliente (compatibilidade garantida)
      const items = await base44.entities.CalendarEvent.list();
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60_000,
  });
}

function withinRange(date, start, end) {
  const d = date instanceof Date ? date : parseISO(date);
  return d >= start && d <= end;
}

const TYPE_COLORS = {
  obra_inicio: 'bg-blue-100 text-blue-700 border-blue-200',
  obra_fim: 'bg-green-100 text-green-700 border-green-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200'
};

export default function CalendarMonth({ monthDate, onPrev, onNext, onToday, filters, onFiltersChange }) {
  const { data: events = [], isLoading, error } = useCalendarEvents();

  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const monthDays = getMonthGrid(monthDate);

  // Filtragem por mês e tipo
  const monthEvents = React.useMemo(() => {
    const filtered = events.filter(ev => withinRange(ev.start_date || ev.date || ev.created_date, start, end));
    if (!filters?.types || filters.types.length === 0) return filtered;
    return filtered.filter(ev => filters.types.includes(ev.event_type || 'default'));
  }, [events, start, end, filters]);

  const eventsByDay = React.useMemo(() => {
    const map = new Map();
    monthEvents.forEach(ev => {
      const d = format(parseISO(ev.start_date || ev.date || ev.created_date), 'yyyy-MM-dd');
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(ev);
    });
    return map;
  }, [monthEvents]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 text-slate-700">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">
            {format(monthDate, "LLLL yyyy", { locale: ptBR })}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrev} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={onNext} className="h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" /> Filtrar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <p className="text-sm font-medium mb-2">Tipos de evento</p>
              <div className="space-y-2">
                {[
                  { key: 'obra_inicio', label: 'Início de Obra' },
                  { key: 'obra_fim', label: 'Término de Obra' },
                  { key: 'default', label: 'Outros' },
                ].map(t => {
                  const checked = filters?.types?.includes(t.key) || false;
                  return (
                    <label key={t.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(ck) => {
                          const current = new Set(filters?.types || []);
                          if (ck) current.add(t.key); else current.delete(t.key);
                          onFiltersChange?.({ ...filters, types: Array.from(current) });
                        }}
                      />
                      <span>{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Estados */}
      {isLoading && (
        <div className="py-8 text-center text-sm text-slate-500">Carregando eventos…</div>
      )}
      {error && (
        <div className="py-8 text-center text-sm text-red-600">Erro ao carregar eventos</div>
      )}

      {/* Semana */}
      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-slate-500 mb-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) || [];
          const isCurrentMonth = isSameMonth(day, monthDate);
          const active = isToday(day);

          return (
            <div
              key={key + idx}
              className={
                'rounded-xl border p-2 min-h-[84px] flex flex-col gap-1 ' +
                (active ? 'border-blue-400 ring-2 ring-blue-200 ' : 'border-slate-200 ') +
                (isCurrentMonth ? 'bg-slate-50' : 'bg-white opacity-60')
              }
            >
              <div className="text-xs text-slate-600 mb-1 flex items-center justify-between">
                <span className={active ? 'font-semibold text-blue-700' : ''}>{format(day, 'd')}</span>
              </div>

              {/* Eventos do dia */}
              <div className="space-y-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => {
                  const color = TYPE_COLORS[ev.event_type] || TYPE_COLORS.default;
                  return (
                    <div key={ev.id} className={`text-[10px] border rounded px-1 py-0.5 truncate ${color}`} title={ev.title || ev.description}>
                      {(ev.title || 'evento')?.slice(0, 18)}{(ev.title || '').length > 18 ? '…' : ''}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-slate-500">+{dayEvents.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}