import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, Trash2, Copy } from 'lucide-react';
import { PageSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

const tipoConfig = {
  servico: { label: 'Serviço', color: 'bg-green-100 text-green-800' },
  material: { label: 'Material', color: 'bg-blue-100 text-blue-800' },
  mao_obra: { label: 'Mão de Obra', color: 'bg-amber-100 text-amber-800' },
  equipamento: { label: 'Equipamento', color: 'bg-purple-100 text-purple-800' }
};

const origemConfig = {
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-800' },
  sinapi: { label: 'SINAPI', color: 'bg-blue-100 text-blue-800' },
  orcafacil: { label: 'OrçaFascio', color: 'bg-indigo-100 text-indigo-800' },
  importado: { label: 'Importado', color: 'bg-cyan-100 text-cyan-800' }
};

const statusConfig = {
  rascunho: { label: 'Rascunho', icon: '' },
  em_revisao: { label: 'Em Revisão', icon: '' },
  aprovado: { label: 'Aprovado', icon: '' },
  bloqueado: { label: 'Bloqueado', icon: '' }
};

export default function ComposicoesList() {
  const [busca, setBusca] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterOrigem, setFilterOrigem] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const queryClient = useQueryClient();

  const { data: composicoes = [], isLoading } = useQuery({
    queryKey: ['composicoes'],
    queryFn: () => base44.entities.Composicao.list('-created_date', 200)
  });

  const { mutate: deleteComposicao } = useMutation({
    mutationFn: (id) => base44.entities.Composicao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composicoes'] });
      toast.success('Composição deletada');
    }
  });

  const { mutate: duplicarComposicao } = useMutation({
    mutationFn: (id) => base44.functions.invoke('duplicarComposicao', { composicao_id: id }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['composicoes'] });
      toast.success(`Composição duplicada: ${response.data.composicao_nova.codigo}`);
    }
  });

  const filtradas = composicoes.filter(c => {
    const matchBusca = c.codigo?.toLowerCase().includes(busca.toLowerCase()) ||
                       c.descricao?.toLowerCase().includes(busca.toLowerCase());
    const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;
    const matchOrigem = filterOrigem === 'todos' || c.origem === filterOrigem;
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    return matchBusca && matchTipo && matchOrigem && matchStatus;
  });

  if (isLoading) {
    return <div className="p-6"><PageSkeleton kpis={4} rows={6} cols={4} /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Composições</h1>
          <p className="text-gray-600 mt-2">Catálogo de composições SINAPI-like</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <a href={createPageUrl('ComposicaoDetalhes')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Composição
          </a>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm font-medium">Total</p>
            <p className="text-3xl font-bold text-gray-900">{composicoes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm font-medium">Aprovadas</p>
            <p className="text-3xl font-bold text-emerald-600">{composicoes.filter(c => c.status === 'aprovado').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm font-medium">SINAPI</p>
            <p className="text-3xl font-bold text-blue-600">{composicoes.filter(c => c.origem === 'sinapi').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm font-medium">Custo Total</p>
            <p className="text-2xl font-bold text-purple-600">
              R$ {(composicoes.reduce((acc, c) => acc + (c.custo_total || 0), 0)).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Busca</label>
              <Input
                placeholder="Código ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Tipo</label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(tipoConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Origem</label>
              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(origemConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8"
                onClick={() => {
                  setBusca('');
                  setFilterTipo('todos');
                  setFilterOrigem('todos');
                  setFilterStatus('todos');
                }}
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="space-y-3">
        {filtradas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-600">
              Nenhuma composição encontrada
            </CardContent>
          </Card>
        ) : (
          filtradas.map(comp => (
            <Card key={comp.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {comp.codigo && <Badge className="font-mono text-xs">{comp.codigo}</Badge>}
                      <Badge className={tipoConfig[comp.tipo]?.color}>{tipoConfig[comp.tipo]?.label}</Badge>
                      <Badge className={origemConfig[comp.origem]?.color}>{origemConfig[comp.origem]?.label}</Badge>
                      <span className="text-lg">{statusConfig[comp.status]?.icon}</span>
                    </div>
                    <h3 className="text-gray-900 font-semibold mb-1">{comp.descricao}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Unidade: <span className="font-mono">{comp.unidade}</span></div>
                      <div>Custo Total: <span className="font-bold text-blue-600">R$ {(comp.custo_total || 0).toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      title="Ver detalhes"
                    >
                      <a href={createPageUrl(`ComposicaoDetalhes?id=${comp.id}`)}>
                        <Eye className="w-4 h-4 text-blue-600" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicarComposicao(comp.id)}
                      title="Duplicar"
                    >
                      <Copy className="w-4 h-4 text-amber-600" />
                    </Button>
                    {comp.status !== 'bloqueado' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteComposicao(comp.id)}
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}