import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, ChevronDown, X } from 'lucide-react';

export default function AgendaFiltros({ filtros, onFiltroChange, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  const tipos = ['reuniao', 'visita', 'prazo', 'entrega', 'interno'];
  const statuses = ['agendado', 'concluido', 'cancelado'];
  const prioridades = ['baixa', 'media', 'alta'];

  const ativos = ['de', 'ate', 'tipo', 'status', 'prioridade', 'busca'].filter((k) => filtros?.[k]).length;

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      {/* Cabeçalho clicável — expande/recolhe */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Filtros</h3>
          {ativos > 0 && (
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
              {ativos}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`} />
        </button>
        {ativos > 0 && (
          <Button variant="ghost" size="sm" onClick={onLimpar} className="text-xs flex-shrink-0">
            <X className="w-3 h-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Conteúdo — anima a altura (grid-rows 0fr → 1fr) */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">De</label>
              <Input
                type="date"
                value={filtros.de || ''}
                onChange={(e) => onFiltroChange('de', e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Até</label>
              <Input
                type="date"
                value={filtros.ate || ''}
                onChange={(e) => onFiltroChange('ate', e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Tipo</label>
              <Select value={filtros.tipo || ''} onValueChange={(v) => onFiltroChange('tipo', v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
              <Select value={filtros.status || ''} onValueChange={(v) => onFiltroChange('status', v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Prioridade</label>
              <Select value={filtros.prioridade || ''} onValueChange={(v) => onFiltroChange('prioridade', v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas</SelectItem>
                  {prioridades.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Busca</label>
              <Input
                type="text"
                placeholder="Título..."
                value={filtros.busca || ''}
                onChange={(e) => onFiltroChange('busca', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
