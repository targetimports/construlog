import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Search } from 'lucide-react';

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

export default function FiltrosAvancadosObras({ 
  filtros, 
  onFiltrosChange, 
  onLimpar 
}) {
  const [expandido, setExpandido] = useState(false);

  const handleChange = (campo, valor) => {
    onFiltrosChange({ ...filtros, [campo]: valor });
  };

  const temFiltros = Object.values(filtros).some(v => v && v !== '' && v !== 'nome' && v !== 'asc');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Busca Avançada</h3>
          {temFiltros && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {Object.values(filtros).filter(v => v && v !== '' && v !== 'nome' && v !== 'asc').length} filtro(s)
            </span>
          )}
        </div>
        <button
          onClick={() => setExpandido(!expandido)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          {expandido ? 'Recolher ▲' : 'Expandir ▼'}
        </button>
      </div>

      {/* Filtros Expandidos */}
      {expandido && (
        <div className="space-y-4 mb-4">
          {/* Linha 1: Nome e Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome da Obra</Label>
              <Input
                placeholder="Pesquisar por nome..."
                value={filtros.nome || ''}
                onChange={(e) => handleChange('nome', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Cliente / Contratante</Label>
              <Input
                placeholder="Pesquisar por cliente..."
                value={filtros.cliente || ''}
                onChange={(e) => handleChange('cliente', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Linha 2: Cidade e Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Cidade</Label>
              <Input
                placeholder="Pesquisar por cidade..."
                value={filtros.cidade || ''}
                onChange={(e) => handleChange('cidade', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Estado</Label>
              <Select value={filtros.estado || ''} onValueChange={(v) => handleChange('estado', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar estado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos os estados</SelectItem>
                  {ESTADOS.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3: Responsável Técnico */}
          <div>
            <Label className="text-xs font-semibold text-gray-700">Responsável Técnico</Label>
            <Input
              placeholder="Pesquisar por responsável..."
              value={filtros.responsavel_tecnico || ''}
              onChange={(e) => handleChange('responsavel_tecnico', e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Linha 4: Período de Datas */}
          <div className="bg-gray-50 rounded p-3 space-y-3">
            <div className="text-xs font-semibold text-gray-700">Período de Datas</div>
            
            <div>
              <Label className="text-xs text-gray-600">Data de Início</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <Input
                    type="date"
                    placeholder="De..."
                    value={filtros.data_inicio_min || ''}
                    onChange={(e) => handleChange('data_inicio_min', e.target.value)}
                    title="De"
                  />
                  <div className="text-xs text-gray-500 mt-1">De</div>
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Até..."
                    value={filtros.data_inicio_max || ''}
                    onChange={(e) => handleChange('data_inicio_max', e.target.value)}
                    title="Até"
                  />
                  <div className="text-xs text-gray-500 mt-1">Até</div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Data de Término Previsto</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <Input
                    type="date"
                    placeholder="De..."
                    value={filtros.data_fim_min || ''}
                    onChange={(e) => handleChange('data_fim_min', e.target.value)}
                    title="De"
                  />
                  <div className="text-xs text-gray-500 mt-1">De</div>
                </div>
                <div>
                  <Input
                    type="date"
                    placeholder="Até..."
                    value={filtros.data_fim_max || ''}
                    onChange={(e) => handleChange('data_fim_max', e.target.value)}
                    title="Até"
                  />
                  <div className="text-xs text-gray-500 mt-1">Até</div>
                </div>
              </div>
            </div>
          </div>

          {/* Linha 5: Ordenação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Ordenar Por</Label>
              <Select value={filtros.ordenarPor || 'nome'} onValueChange={(v) => handleChange('ordenarPor', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome da Obra</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="cidade">Cidade</SelectItem>
                  <SelectItem value="data_inicio">Data de Início</SelectItem>
                  <SelectItem value="data_fim">Data de Término</SelectItem>
                  <SelectItem value="responsavel">Responsável Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Ordem</Label>
              <Select value={filtros.ordem || 'asc'} onValueChange={(v) => handleChange('ordem', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Ordem..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Crescente (A → Z)</SelectItem>
                  <SelectItem value="desc">Decrescente (Z → A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Ações */}
      {temFiltros && (
        <div className="flex gap-2 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={onLimpar}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Limpar Filtros
          </Button>
        </div>
      )}
    </div>
  );
}