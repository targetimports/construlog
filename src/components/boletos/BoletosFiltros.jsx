import React from 'react';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import { Search } from 'lucide-react';

const STATUS = [
  { v: 'RASCUNHO', l: 'Rascunho' }, { v: 'ABERTO', l: 'Aberto' },
  { v: 'PAGO', l: 'Pago' }, { v: 'CANCELADO', l: 'Cancelado' },
];

export default function BoletosFiltros({ filtros, setFiltros, obras }) {
  const update = (key, val) => setFiltros((f) => ({ ...f, [key]: val }));
  const ativos = Object.values(filtros).filter((v) => v && v !== 'todos').length;

  return (
    <FiltrosColapsaveis ativos={ativos} onLimpar={() => setFiltros({})}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">Busca</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Descrição ou fornecedor..."
              value={filtros.busca || ''}
              onChange={(e) => update('busca', e.target.value)}
              className="pl-9 h-11"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Status</label>
          <ComboboxBusca
            options={[{ value: 'todos', label: 'Todos' }, ...STATUS.map((s) => ({ value: s.v, label: s.l }))]}
            value={filtros.status || ''}
            onSelect={(v) => update('status', v === 'todos' ? '' : v)}
            placeholder="Todos"
            searchPlaceholder="Buscar status..."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Obra</label>
          <ComboboxBusca
            options={[{ value: 'todos', label: 'Todas as obras' }, ...(obras || []).map((o) => ({ value: o.id, label: o.nome }))]}
            value={filtros.obra_id || ''}
            onSelect={(v) => update('obra_id', v === 'todos' ? '' : v)}
            placeholder="Todas"
            searchPlaceholder="Buscar obra..."
            emptyMessage="Nenhuma obra."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Vencimento de</label>
          <Input type="date" value={filtros.venc_de || ''} onChange={(e) => update('venc_de', e.target.value)} className="h-11" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Vencimento até</label>
          <Input type="date" value={filtros.venc_ate || ''} onChange={(e) => update('venc_ate', e.target.value)} className="h-11" />
        </div>
      </div>
    </FiltrosColapsaveis>
  );
}
