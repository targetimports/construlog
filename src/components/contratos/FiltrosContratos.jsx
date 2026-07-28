import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Search, X } from 'lucide-react';

const VAZIO = { obra_id: '', fornecedor_id: '', tipo: '', status: '', texto: '' };

export default function FiltrosContratos({ onFiltroChange, onLimpar }) {
  const [filtros, setFiltros] = useState(VAZIO);

  const { data: obras = [] } = useQuery({ queryKey: ['obras-contratos-filtro'], queryFn: () => base44.entities.Obra.list('-created_date', 500) });
  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores-contratos-filtro'], queryFn: () => base44.entities.Fornecedor.list('-created_date', 1000).catch(() => []) });

  const aplicar = (campo, valor) => {
    const novos = { ...filtros, [campo]: valor };
    setFiltros(novos);
    // remove vazios antes de enviar
    const limpo = Object.fromEntries(Object.entries(novos).filter(([, v]) => v));
    onFiltroChange(limpo);
  };

  const limpar = () => { setFiltros(VAZIO); onLimpar(); };
  const temFiltro = Object.values(filtros).some((v) => v);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Número ou título" value={filtros.texto} onChange={(e) => aplicar('texto', e.target.value)} className="pl-9 h-11" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Obra</label>
          <ComboboxBusca
            options={obras.map((o) => ({ value: o.id, label: o.nome }))}
            value={filtros.obra_id}
            onSelect={(v) => aplicar('obra_id', v)}
            placeholder="Todas" searchPlaceholder="Buscar obra..." emptyMessage="Nenhuma obra."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Fornecedor</label>
          <ComboboxBusca
            options={fornecedores.map((f) => ({ value: f.id, label: f.nome || f.razao_social || f.id }))}
            value={filtros.fornecedor_id}
            onSelect={(v) => aplicar('fornecedor_id', v)}
            placeholder="Todos" searchPlaceholder="Buscar fornecedor..." emptyMessage="Nenhum fornecedor."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Tipo</label>
          <Select value={filtros.tipo || 'todos'} onValueChange={(v) => aplicar('tipo', v === 'todos' ? '' : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="empreitada">Empreitada</SelectItem>
              <SelectItem value="fornecimento">Fornecimento</SelectItem>
              <SelectItem value="prestacao_servico">Prestação de Serviço</SelectItem>
              <SelectItem value="subcontratacao">Subcontratação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Status</label>
          <Select value={filtros.status || 'todos'} onValueChange={(v) => aplicar('status', v === 'todos' ? '' : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {temFiltro && (
        <div className="flex">
          <Button variant="ghost" size="sm" onClick={limpar} className="gap-1.5 text-gray-500 hover:text-gray-700">
            <X className="h-4 w-4" /> Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
