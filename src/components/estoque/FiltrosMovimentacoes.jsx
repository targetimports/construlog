import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FiltrosMovimentacoes({ filtros, onFiltrosChange, onLimpar }) {
  const [expandido, setExpandido] = useState(false);

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-filtro'],
    queryFn: () => base44.entities.Insumo.list('descricao', 500)
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados-filtro'],
    queryFn: () => base44.entities.Almoxarifado.list('nome', 100)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro-mov'],
    queryFn: () => base44.entities.Obra.list('nome', 500)
  });

  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtros.tipo) count++;
    if (filtros.almoxarifado_id) count++;
    if (filtros.obra_id) count++;
    if (filtros.insumo_id) count++;
    if (filtros.dataInicio || filtros.dataFim) count++;
    if (filtros.usuario) count++;
    if (filtros.busca) count++;
    return count;
  };

  const filtrosAtivos = contarFiltrosAtivos();

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandido(!expandido)}
              className="gap-2"
            >
              <Filter className="w-4 h-4" />
              Filtros Avançados
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {filtrosAtivos > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
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
              placeholder="Buscar por observação ou referência (OC, NF)..."
              value={filtros.busca || ''}
              onChange={(e) => onFiltrosChange({ ...filtros, busca: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros expandidos */}
        {expandido && (
          <div className="space-y-3 pt-3 border-t">
            {/* Linha 1: Tipo + Insumo + Almoxarifado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Tipo</label>
                <Select
                  value={filtros.tipo || ''}
                  onValueChange={(value) => onFiltrosChange({ ...filtros, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    <SelectItem value="entrada_compra">Entrada Compra</SelectItem>
                    <SelectItem value="entrada_transferencia">Entrada Transferência</SelectItem>
                    <SelectItem value="saida_consumo">Saída Consumo</SelectItem>
                    <SelectItem value="saida_transferencia">Saída Transferência</SelectItem>
                    <SelectItem value="saida_devolucao">Devolução</SelectItem>
                    <SelectItem value="ajuste_inventario">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Insumo</label>
                <Select
                  value={filtros.insumo_id || ''}
                  onValueChange={(value) => onFiltrosChange({ ...filtros, insumo_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {insumos.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Depósito</label>
                <Select
                  value={filtros.almoxarifado_id || ''}
                  onValueChange={(value) => onFiltrosChange({ ...filtros, almoxarifado_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {almoxarifados.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Obra + Período */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Obra</label>
                <Select
                  value={filtros.obra_id || ''}
                  onValueChange={(value) => onFiltrosChange({ ...filtros, obra_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todas</SelectItem>
                    {obras.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Linha 3: Usuário */}
            <div>
              <label className="block text-xs font-medium mb-1">Usuário</label>
              <Input
                placeholder="Email do responsável"
                value={filtros.usuario || ''}
                onChange={(e) => onFiltrosChange({ ...filtros, usuario: e.target.value })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}