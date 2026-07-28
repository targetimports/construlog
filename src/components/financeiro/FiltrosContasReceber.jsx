import React from 'react';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';

const STATUS = [
  { v: 'pendente', l: 'Pendente' }, { v: 'parcial', l: 'Parcial' },
  { v: 'recebido', l: 'Recebido' }, { v: 'atrasado', l: 'Vencido' },
  { v: 'cancelado', l: 'Cancelado' },
];
const FORMAS = [
  { v: 'pix', l: 'PIX' }, { v: 'transferencia', l: 'Transferência' },
  { v: 'boleto', l: 'Boleto' }, { v: 'cheque', l: 'Cheque' }, { v: 'dinheiro', l: 'Dinheiro' },
];

export default function FiltrosContasReceber({ filtros, setFiltros, obras = [], clientes = [] }) {
  const set = (campo, valor) => setFiltros({ ...filtros, [campo]: valor });
  const ativos = Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== 0).length;

  return (
    <FiltrosColapsaveis ativos={ativos} onLimpar={() => setFiltros({})}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="lg:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Busca</label>
          <Input className="h-11" placeholder="Descrição, cliente ou referência..." value={filtros.busca || ''} onChange={(e) => set('busca', e.target.value)} />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Obra</label>
          <ComboboxBusca
            options={[{ value: '__all', label: 'Todas as obras' }, ...obras.map((o) => ({ value: o.id, label: o.nome || o.codigo || o.id }))]}
            value={filtros.obra_id || ''}
            onSelect={(v) => set('obra_id', v === '__all' ? '' : v)}
            placeholder="Todas"
            searchPlaceholder="Buscar obra..."
            emptyMessage="Nenhuma obra."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Cliente</label>
          <ComboboxBusca
            options={[{ value: '__all', label: 'Todos os clientes' }, ...clientes.map((c) => ({ value: c.id, label: c.nome || c.razao_social || c.id }))]}
            value={filtros.cliente_id || ''}
            onSelect={(v) => set('cliente_id', v === '__all' ? '' : v)}
            placeholder="Todos"
            searchPlaceholder="Buscar cliente..."
            emptyMessage="Nenhum cliente."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Status</label>
          <ComboboxBusca
            options={[{ value: '__all', label: 'Todos' }, ...STATUS.map((s) => ({ value: s.v, label: s.l }))]}
            value={filtros.status || ''}
            onSelect={(v) => set('status', v === '__all' ? '' : v)}
            placeholder="Todos"
            searchPlaceholder="Buscar status..."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Forma de recebimento</label>
          <ComboboxBusca
            options={[{ value: '__all', label: 'Todas' }, ...FORMAS.map((f) => ({ value: f.v, label: f.l }))]}
            value={filtros.forma_pagamento || ''}
            onSelect={(v) => set('forma_pagamento', v === '__all' ? '' : v)}
            placeholder="Todas"
            searchPlaceholder="Buscar forma..."
          />
        </div>

        <div>
          <label className="block text-xs text-gray-600 mb-1">Vencimento de</label>
          <Input className="h-11" type="date" value={filtros.data_vencimento_de || ''} onChange={(e) => set('data_vencimento_de', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Vencimento até</label>
          <Input className="h-11" type="date" value={filtros.data_vencimento_ate || ''} onChange={(e) => set('data_vencimento_ate', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Valor mínimo</label>
          <Input className="h-11" type="number" step="0.01" placeholder="0,00" value={filtros.valor_min || ''} onChange={(e) => set('valor_min', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Valor máximo</label>
          <Input className="h-11" type="number" step="0.01" placeholder="0,00" value={filtros.valor_max || ''} onChange={(e) => set('valor_max', parseFloat(e.target.value) || 0)} />
        </div>
      </div>
    </FiltrosColapsaveis>
  );
}
