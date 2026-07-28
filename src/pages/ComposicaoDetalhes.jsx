import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, RotateCcw, Copy } from 'lucide-react';
import { PageSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

const tipoConfig = {
  servico: 'Serviço',
  material: 'Material',
  mao_obra: 'Mão de Obra',
  equipamento: 'Equipamento'
};

const statusConfig = {
  rascunho: 'Rascunho',
  em_revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  bloqueado: 'Bloqueado'
};

export default function ComposicaoDetalhes() {
  const [composicaoId, setComposicaoId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [adicionandoItem, setAdicionandoItem] = useState(false);
  const [novoItem, setNovoItem] = useState({ insumo_id: '', coeficiente: 0, perda_percent: 0 });
  const queryClient = useQueryClient();

  // Parse URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setComposicaoId(id);
  }, []);

  const { data: composicao, isLoading: loadingComp } = useQuery({
    queryKey: ['composicao', composicaoId],
    queryFn: () => base44.entities.Composicao.filter({ id: composicaoId }).then(r => r[0]),
    enabled: !!composicaoId
  });

  const { data: itens = [] } = useQuery({
    queryKey: ['composicao-itens', composicaoId],
    queryFn: () => base44.entities.ComposicaoItem.filter({ composicao_id: composicaoId }),
    enabled: !!composicaoId
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list('-created_date', 500)
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Composicao.update(composicaoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composicao', composicaoId] });
      toast.success('Composição atualizada');
      setEditForm(null);
    }
  });

  const adicionarItemMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.insumo_id) throw new Error('Selecione um insumo');
      
      const insumo = insumos.find(i => i.id === data.insumo_id);
      if (!insumo) throw new Error('Insumo não encontrado');

      const ordem = Math.max(...itens.map(i => i.ordem || 0), 0) + 1;

      return base44.entities.ComposicaoItem.create({
        composicao_id: composicaoId,
        insumo_id: data.insumo_id,
        codigo_insumo_snapshot: insumo.codigo,
        descricao_insumo_snapshot: insumo.descricao,
        unidade_snapshot: insumo.unidade,
        grupo_snapshot: insumo.grupo,
        preco_unitario_snapshot: insumo.preco_unitario,
        coeficiente: data.coeficiente,
        perda_percent: data.perda_percent,
        ordem
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composicao-itens', composicaoId] });
      toast.success('Item adicionado');
      setAdicionandoItem(false);
      setNovoItem({ insumo_id: '', coeficiente: 0, perda_percent: 0 });
      
      // Recalcular
      base44.functions.invoke('recalcularComposicao', { composicao_id: composicaoId });
    }
  });

  const deletarItemMutation = useMutation({
    mutationFn: (itemId) => base44.entities.ComposicaoItem.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composicao-itens', composicaoId] });
      toast.success('Item removido');
      
      // Recalcular
      base44.functions.invoke('recalcularComposicao', { composicao_id: composicaoId });
    }
  });

  const duplicarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('duplicarComposicao', { composicao_id: composicaoId }),
    onSuccess: (response) => {
      toast.success('Composição duplicada');
      window.location.href = createPageUrl(`ComposicaoDetalhes?id=${response.data.composicao_nova_id}`);
    }
  });

  const recalcularMutation = useMutation({
    mutationFn: () => base44.functions.invoke('recalcularComposicao', { composicao_id: composicaoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composicao', composicaoId] });
      toast.success('Composição recalculada');
    }
  });

  if (!composicaoId) {
    return (
      <div className="p-6">
        <Button asChild>
          <a href={createPageUrl('Composicoes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </a>
        </Button>
      </div>
    );
  }

  if (loadingComp || !composicao) {
    return <div className="p-6"><PageSkeleton kpis={5} rows={6} cols={8} /></div>;
  }

  const isReadOnly = composicao.status === 'bloqueado';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex gap-2">
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={() => recalcularMutation.mutate()}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Recalcular
              </Button>
              <Button variant="outline" onClick={() => duplicarMutation.mutate()}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Composição Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {composicao.codigo && <Badge className="font-mono">{composicao.codigo}</Badge>}
                <Badge>{tipoConfig[composicao.tipo]}</Badge>
                <Badge variant="secondary">{composicao.origem}</Badge>
                <Badge>{statusConfig[composicao.status]}</Badge>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{composicao.descricao}</h1>
            </div>
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditForm(composicao)}
              >
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Unidade</p>
              <p className="font-semibold">{composicao.unidade}</p>
            </div>
            <div>
              <p className="text-gray-600">Data Ref.</p>
              <p className="font-semibold">{composicao.data_referencia || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600">Estado</p>
              <p className="font-semibold">{composicao.estado || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600">Desonerado</p>
              <p className="font-semibold">{composicao.desonerado ? 'Sim' : 'Não'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custos */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Materiais</p>
            <p className="text-2xl font-bold text-blue-600">R$ {(composicao.custo_materiais || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Mão de Obra</p>
            <p className="text-2xl font-bold text-amber-600">R$ {(composicao.custo_mao_obra || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Equipamentos</p>
            <p className="text-2xl font-bold text-purple-600">R$ {(composicao.custo_equipamentos || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm">Outros</p>
            <p className="text-2xl font-bold text-cyan-600">R$ {(composicao.custo_outros || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-500">
          <CardContent className="p-4">
            <p className="text-gray-600 text-sm font-semibold">TOTAL</p>
            <p className="text-3xl font-bold text-green-600">R$ {(composicao.custo_total || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Itens */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Itens ({itens.length})</CardTitle>
          {!isReadOnly && (
            <Button size="sm" onClick={() => setAdicionandoItem(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {itens.length === 0 ? (
            <p className="text-center text-gray-600 py-8">Nenhum item adicionado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Insumo</th>
                    <th className="px-4 py-2 text-left">Grupo</th>
                    <th className="px-4 py-2 text-center">Un.</th>
                    <th className="px-4 py-2 text-right">Preço Unit.</th>
                    <th className="px-4 py-2 text-right">Coef.</th>
                    <th className="px-4 py-2 text-right">Perda %</th>
                    <th className="px-4 py-2 text-right">Custo Item</th>
                    {!isReadOnly && <th className="px-4 py-2 text-center">Ação</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itens.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-mono text-xs text-gray-600">{item.codigo_insumo_snapshot}</p>
                          <p className="text-gray-900">{item.descricao_insumo_snapshot}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{item.grupo_snapshot}</Badge>
                      </td>
                      <td className="px-4 py-2 text-center">{item.unidade_snapshot}</td>
                      <td className="px-4 py-2 text-right font-mono">R$ {(item.preco_unitario_snapshot || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{item.coeficiente}</td>
                      <td className="px-4 py-2 text-right">{item.perda_percent}%</td>
                      <td className="px-4 py-2 text-right font-bold text-blue-600">R$ {(item.custo_total_item || 0).toFixed(2)}</td>
                      {!isReadOnly && (
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletarItemMutation.mutate(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Adicionar Item */}
      <Dialog open={adicionandoItem} onOpenChange={setAdicionandoItem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Insumo</label>
              <Select value={novoItem.insumo_id} onValueChange={(id) => setNovoItem({...novoItem, insumo_id: id})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {insumos.filter(i => i.ativo).map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.codigo} - {i.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Coeficiente</label>
              <Input
                type="number"
                step="0.01"
                value={novoItem.coeficiente}
                onChange={(e) => setNovoItem({...novoItem, coeficiente: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Perda %</label>
              <Input
                type="number"
                step="0.1"
                value={novoItem.perda_percent}
                onChange={(e) => setNovoItem({...novoItem, perda_percent: parseFloat(e.target.value) || 0})}
              />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => adicionarItemMutation.mutate(novoItem)}
              disabled={!novoItem.insumo_id}
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar */}
      <Dialog open={!!editForm} onOpenChange={() => setEditForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Composição</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <Input
                placeholder="Código"
                defaultValue={editForm.codigo}
                onChange={(e) => setEditForm({...editForm, codigo: e.target.value})}
              />
              <Input
                placeholder="Descrição"
                defaultValue={editForm.descricao}
                onChange={(e) => setEditForm({...editForm, descricao: e.target.value})}
              />
              <Input
                placeholder="Data Ref. (2024-12)"
                defaultValue={editForm.data_referencia}
                onChange={(e) => setEditForm({...editForm, data_referencia: e.target.value})}
              />
              <Input
                placeholder="Estado"
                defaultValue={editForm.estado}
                onChange={(e) => setEditForm({...editForm, estado: e.target.value})}
              />
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => updateMutation.mutate(editForm)}
              >
                Salvar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}