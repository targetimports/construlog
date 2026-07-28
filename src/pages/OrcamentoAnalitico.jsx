import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Copy, Trash2, Edit, Search, Filter } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

export default function OrcamentoAnalitico() {
  const [obra, setObra] = useState('');
  const [filtro, setFiltro] = useState('');
  const [sortBy, setSortBy] = useState('codigo');
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: composicoes = [], isLoading } = useQuery({
    queryKey: ['composicoes'],
    queryFn: () => base44.entities.Composicao.list('-updated_date', 1000)
  });

  const filtrados = useMemo(() => {
    return composicoes
      .filter(c => !filtro || 
        c.codigo?.toLowerCase().includes(filtro.toLowerCase()) ||
        c.descricao?.toLowerCase().includes(filtro.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'codigo') return a.codigo.localeCompare(b.codigo);
        if (sortBy === 'preco') return a.preco_unitario - b.preco_unitario;
        return a.descricao.localeCompare(b.descricao);
      });
  }, [composicoes, filtro, sortBy]);

  const categorias = [
    { value: 'materiais', label: 'Materiais' },
    { value: 'mao_obra', label: 'Mão de Obra' },
    { value: 'equipamentos', label: 'Equipamentos' },
    { value: 'servicos', label: 'Serviços' },
    { value: 'mobilizacao', label: 'Mobilização' },
    { value: 'outros', label: 'Outros' }
  ];

  const totalMateriais = filtrados
    .filter(c => c.categoria_servico === 'materiais')
    .reduce((sum, c) => sum + (c.preco_unitario || 0), 0);

  const totalMaoObra = filtrados
    .filter(c => c.categoria_servico === 'mao_obra')
    .reduce((sum, c) => sum + (c.preco_unitario || 0), 0);

  const totalEquipamentos = filtrados
    .filter(c => c.categoria_servico === 'equipamentos')
    .reduce((sum, c) => sum + (c.preco_unitario || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orçamento Analítico</h1>
        <p className="text-gray-600 mt-1">Composições de custo por atividade e obra</p>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Materiais</div>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              R$ {totalMateriais.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {filtrados.filter(c => c.categoria_servico === 'materiais').length} itens
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Mão de Obra</div>
            <div className="text-2xl font-bold text-green-600 mt-2">
              R$ {totalMaoObra.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {filtrados.filter(c => c.categoria_servico === 'mao_obra').length} itens
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Equipamentos</div>
            <div className="text-2xl font-bold text-orange-600 mt-2">
              R$ {totalEquipamentos.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {filtrados.filter(c => c.categoria_servico === 'equipamentos').length} itens
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              R$ {(totalMateriais + totalMaoObra + totalEquipamentos).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {filtrados.length} composições
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700 block mb-2">Pesquisar</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Código, descrição..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Ordenar por</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="codigo">Código</SelectItem>
                  <SelectItem value="descricao">Descrição</SelectItem>
                  <SelectItem value="preco">Preço</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Obra</label>
              <Select value={obra} onValueChange={setObra}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as obras</SelectItem>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Composições */}
      <Card>
        <CardHeader>
          <CardTitle>Composições ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtrados.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma composição encontrada. Importe planilhas em Base de Composições.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Unidade</TableHead>
                    <TableHead className="text-right">Preço Unitário</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(comp => (
                    <TableRow key={comp.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono font-semibold">{comp.codigo}</TableCell>
                      <TableCell className="max-w-xs">{comp.descricao}</TableCell>
                      <TableCell className="text-center">{comp.unidade}</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {comp.preco_unitario?.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {categorias.find(c => c.value === comp.categoria_servico)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={comp.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {comp.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}