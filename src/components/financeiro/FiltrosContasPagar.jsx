import React from 'react';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';

const CATEGORIAS = [
  { v: 'material', l: 'Material' }, { v: 'mao_de_obra', l: 'Mão de Obra' },
  { v: 'equipamento', l: 'Equipamento' }, { v: 'transporte', l: 'Transporte' },
  { v: 'servico', l: 'Serviço' }, { v: 'imposto', l: 'Imposto' }, { v: 'outros', l: 'Outros' },
];
const STATUS = [
  { v: 'pendente', l: 'Pendente' }, { v: 'em_aprovacao', l: 'Em Aprovação' },
  { v: 'parcial', l: 'Parcial' }, { v: 'pago', l: 'Pago' },
  { v: 'atrasado', l: 'Atrasado' }, { v: 'cancelado', l: 'Cancelado' },
];

export default function FiltrosContasPagar({ filtros, setFiltros, obras = [] }) {
  const set = (campo, valor) => setFiltros({ ...filtros, [campo]: valor });
  const ativos = Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== 0).length;

  return (
    <FiltrosColapsaveis ativos={ativos} onLimpar={() => setFiltros({})}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Busca</label>
          <Input className="h-11" placeholder="Descrição, fornecedor..." value={filtros.busca || ''} onChange={(e) => set('busca', e.target.value)} />
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
          <label className="block text-xs text-gray-600 mb-1">Categoria</label>
          <ComboboxBusca
            options={[{ value: '__all', label: 'Todas' }, ...CATEGORIAS.map((c) => ({ value: c.v, label: c.l }))]}
            value={filtros.categoria || ''}
            onSelect={(v) => set('categoria', v === '__all' ? '' : v)}
            placeholder="Todas"
            searchPlaceholder="Buscar categoria..."
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
