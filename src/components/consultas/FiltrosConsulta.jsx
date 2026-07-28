import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function FiltrosConsulta({ filtros, onMudanca, onLimpar }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        {filtros.status !== undefined && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
            <Select value={filtros.status} onValueChange={(v) => onMudanca('status', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="reprovada">Reprovada</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="faturada">Faturada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Período */}
        {filtros.dataDe !== undefined && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Data De</label>
              <Input 
                type="date"
                value={filtros.dataDe}
                onChange={(e) => onMudanca('dataDe', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Data Até</label>
              <Input
                type="date"
                value={filtros.dataAte}
                onChange={(e) => onMudanca('dataAte', e.target.value)}
              />
            </div>
          </>
        )}

        {/* Fornecedor */}
        {filtros.fornecedor !== undefined && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Fornecedor</label>
            <Input
              placeholder="Filtrar fornecedor..."
              value={filtros.fornecedor}
              onChange={(e) => onMudanca('fornecedor', e.target.value)}
            />
          </div>
        )}

        {/* Categoria */}
        {filtros.categoria !== undefined && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Categoria</label>
            <Select value={filtros.categoria} onValueChange={(v) => onMudanca('categoria', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todas</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="mao_de_obra">Mão de Obra</SelectItem>
                <SelectItem value="equipamento">Equipamento</SelectItem>
                <SelectItem value="transporte">Transporte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Valor Mínimo */}
        {filtros.valorMin !== undefined && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Valor Mín</label>
            <Input
              type="number"
              placeholder="0"
              value={filtros.valorMin}
              onChange={(e) => onMudanca('valorMin', e.target.value)}
            />
          </div>
        )}

        {/* Valor Máximo */}
        {filtros.valorMax !== undefined && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Valor Máx</label>
            <Input
              type="number"
              placeholder="999999"
              value={filtros.valorMax}
              onChange={(e) => onMudanca('valorMax', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onLimpar}>
          <X className="w-4 h-4 mr-2" />
          Limpar Filtros
        </Button>
      </div>
    </div>
  );
}