import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';

export default function FiltrosMedicoesContrato({ onFiltroChange, onLimpar }) {
  const [filtros, setFiltros] = useState({
    obra_id: '',
    contrato_id: '',
    status: '',
    de: '',
    ate: ''
  });

  const handleChange = (campo, valor) => {
    const novosFiltros = { ...filtros, [campo]: valor };
    setFiltros(novosFiltros);
    onFiltroChange(novosFiltros);
  };

  const handleLimpar = () => {
    setFiltros({ obra_id: '', contrato_id: '', status: '', de: '', ate: '' });
    onLimpar();
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
          <Select value={filtros.status} onValueChange={(valor) => handleChange('status', valor)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="aprovada">Aprovada</SelectItem>
              <SelectItem value="faturada">Faturada</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Obra</label>
          <Input
            placeholder="ID da obra"
            value={filtros.obra_id}
            onChange={(e) => handleChange('obra_id', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Contrato</label>
          <Input
            placeholder="ID do contrato"
            value={filtros.contrato_id}
            onChange={(e) => handleChange('contrato_id', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">De</label>
          <Input
            type="date"
            value={filtros.de}
            onChange={(e) => handleChange('de', e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">Até</label>
          <Input
            type="date"
            value={filtros.ate}
            onChange={(e) => handleChange('ate', e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleLimpar} className="gap-2">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      </div>
    </div>
  );
}