import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

export default function FiltrosDiarioAvancado({ filtros, onFiltrosChange, onLimpar }) {
  const [expandido, setExpandido] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-filtro'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos-filtro'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtros.obra_id) count++;
    if (filtros.dataInicio || filtros.dataFim) count++;
    if (filtros.colaborador_id) count++;
    if (filtros.equipamento_id) count++;
    if (filtros.temOcorrencias) count++;
    if (filtros.status && filtros.status !== 'todos') count++;
    if (filtros.busca) count++;
    return count;
  };

  const filtrosAtivos = contarFiltrosAtivos();

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Header com contador */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandido(!expandido)}
              className="gap-2 flex-1 justify-between"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros Avançados
              </span>
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {filtrosAtivos > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 whitespace-nowrap">
                {filtrosAtivos} {filtrosAtivos === 1 ? 'filtro ativo' : 'filtros ativos'}
              </Badge>
            )}
          </div>
          {filtrosAtivos > 0 && (
            <Button variant="ghost" size="sm" onClick={onLimpar} className="gap-2">
              <X className="w-4 h-4" />
              Limpar Filtros
            </Button>
          )}
        </div>

        {/* Busca sempre visível */}
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por atividades, observações ou ocorrências..."
              value={filtros.busca || ''}
              onChange={(e) => onFiltrosChange({ ...filtros, busca: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros expandidos */}
        {expandido && (
          <div className="space-y-3 pt-3 border-t">
            {/* Linha 1: Obra + Período */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Obra</label>
                <ComboboxBusca
                  options={obras.map(o => ({ value: o.id, label: o.nome }))}
                  value={filtros.obra_id || ''}
                  onSelect={(value) => onFiltrosChange({ ...filtros, obra_id: value })}
                  placeholder="Todas as obras"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra encontrada."
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Data Início</label>
                <Input
                  type="date"
                  value={filtros.dataInicio || ''}
                  onChange={(e) => onFiltrosChange({ ...filtros, dataInicio: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Data Fim</label>
                <Input
                  type="date"
                  value={filtros.dataFim || ''}
                  onChange={(e) => onFiltrosChange({ ...filtros, dataFim: e.target.value })}
                />
              </div>
            </div>

            {/* Linha 2: Colaborador + Equipamento + Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Colaborador</label>
                <ComboboxBusca
                  options={colaboradores.map(c => ({ value: c.id, label: c.nome }))}
                  value={filtros.colaborador_id || ''}
                  onSelect={(value) => onFiltrosChange({ ...filtros, colaborador_id: value })}
                  placeholder="Todos"
                  searchPlaceholder="Buscar colaborador..."
                  emptyMessage="Nenhum colaborador encontrado."
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Equipamento</label>
                <ComboboxBusca
                  options={equipamentos.map(e => ({ value: e.id, label: e.modelo || e.descricao || e.id }))}
                  value={filtros.equipamento_id || ''}
                  onSelect={(value) => onFiltrosChange({ ...filtros, equipamento_id: value })}
                  placeholder="Todos"
                  searchPlaceholder="Buscar equipamento..."
                  emptyMessage="Nenhum equipamento encontrado."
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <Select
                  value={filtros.status || 'todos'}
                  onValueChange={(value) => onFiltrosChange({ ...filtros, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 3: Ocorrências */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="temOcorrencias"
                checked={filtros.temOcorrencias || false}
                onChange={(e) => onFiltrosChange({ ...filtros, temOcorrencias: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="temOcorrencias" className="text-sm cursor-pointer">
                Apenas com ocorrências
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}