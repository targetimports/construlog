import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';

const VAZIO = { obra_id: '', colaborador_id: '', de: '', ate: '', status: '' };

export default function FiltrosApontamentoHoras({ onFiltroChange }) {
  const [filtros, setFiltros] = useState(VAZIO);

  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });
  const { data: colaboradores = [] } = useQuery({ queryKey: ['colaboradores'], queryFn: () => base44.entities.Colaborador.list('-created_date', 5000) });

  const handleChange = (field, value) => {
    const novo = { ...filtros, [field]: value };
    setFiltros(novo);
    onFiltroChange(novo);
  };

  const ativos = Object.values(filtros).filter(Boolean).length;

  return (
    <FiltrosColapsaveis ativos={ativos} onLimpar={() => { setFiltros(VAZIO); onFiltroChange(VAZIO); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
          <ComboboxBusca
            options={obras.map((o) => ({ value: o.id, label: o.nome }))}
            value={filtros.obra_id}
            onSelect={(v) => handleChange('obra_id', v)}
            placeholder="Todas as obras"
            searchPlaceholder="Buscar obra..."
            emptyMessage="Nenhuma obra."
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Colaborador</Label>
          <ComboboxBusca
            options={colaboradores.map((c) => ({ value: c.id, label: c.nome }))}
            value={filtros.colaborador_id}
            onSelect={(v) => handleChange('colaborador_id', v)}
            placeholder="Todos"
            searchPlaceholder="Buscar colaborador..."
            emptyMessage="Nenhum colaborador."
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">De</Label>
          <Input type="date" className="h-11" value={filtros.de} onChange={(e) => handleChange('de', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Até</Label>
          <Input type="date" className="h-11" value={filtros.ate} onChange={(e) => handleChange('ate', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
          <ComboboxBusca
            options={[{ value: 'todos', label: 'Todos' }, { value: 'rascunho', label: 'Rascunho' }, { value: 'aprovado', label: 'Aprovado' }, { value: 'rejeitado', label: 'Rejeitado' }]}
            value={filtros.status || 'todos'}
            onSelect={(v) => handleChange('status', v === 'todos' ? '' : (v || ''))}
            placeholder="Todos"
            searchPlaceholder="Buscar..."
          />
        </div>
      </div>
    </FiltrosColapsaveis>
  );
}
