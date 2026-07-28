import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, Search, X } from 'lucide-react';
import { toast } from 'sonner';

export default function GestaoInsumosComposicao({ composicao, open, onClose }) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInsumo, setSelectedInsumo] = useState(null);
  const [coeficiente, setCoeficiente] = useState('');
  const [observacao, setObservacao] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const queryClient = useQueryClient();

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => base44.entities.Insumo.list('-created_date', 500)
  });

  const { data: composicaoInsumos = [], isLoading } = useQuery({
    queryKey: ['composicao-insumos-gestao', composicao?.id],
    queryFn: async () => {
      if (!composicao?.id) return [];
      
      const relacoes = await base44.entities.ComposicaoInsumo.filter({
        composicao_id: composicao.id
      });

      const insumosData = await Promise.all(
        relacoes.map(async (rel) => {
          const insumo = await base44.entities.Insumo.filter({ id: rel.insumo_id });
          return {
            ...rel,
            insumo: insumo[0]
          };
        })
      );

      return insumosData.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    },
    enabled: !!composicao?.id && open
  });

  const addMutation = useMutation({
    mutationFn: async (data) => {
      const custoParcial = parseFloat(coeficiente) * (selectedInsumo.preco_unitario || 0);
      return base44.entities.ComposicaoInsumo.create({
        composicao_id: composicao.id,
        insumo_id: selectedInsumo.id,
        coeficiente: parseFloat(data.coeficiente),
        custo_parcial: custoParcial,
        observacao: data.observacao,
        ordem: composicaoInsumos.length + 1
      });
    },
    onSuccess: async () => {
      await recalcularComposicao();
      queryClient.invalidateQueries(['composicao-insumos-gestao']);
      queryClient.invalidateQueries(['composicoes']);
      setIsAdding(false);
      setSelectedInsumo(null);
      setCoeficiente('');
      setObservacao('');
      toast.success('Insumo adicionado');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const item = composicaoInsumos.find(i => i.id === id);
      const custoParcial = parseFloat(data.coeficiente) * (item.insumo?.preco_unitario || 0);
      return base44.entities.ComposicaoInsumo.update(id, {
        ...data,
        custo_parcial: custoParcial
      });
    },
    onSuccess: async () => {
      await recalcularComposicao();
      queryClient.invalidateQueries(['composicao-insumos-gestao']);
      queryClient.invalidateQueries(['composicoes']);
      setEditingItem(null);
      toast.success('Insumo atualizado');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ComposicaoInsumo.delete(id),
    onSuccess: async () => {
      await recalcularComposicao();
      queryClient.invalidateQueries(['composicao-insumos-gestao']);
      queryClient.invalidateQueries(['composicoes']);
      toast.success('Insumo removido');
    }
  });

  const recalcularComposicao = async () => {
    try {
      const relacoes = await base44.entities.ComposicaoInsumo.filter({
        composicao_id: composicao.id
      });

      const custoTotal = relacoes.reduce((sum, rel) => sum + (rel.custo_parcial || 0), 0);

      await base44.entities.Composicao.update(composicao.id, {
        custo_unitario: custoTotal,
        ultima_atualizacao: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao recalcular composição:', error);
    }
  };

  const filteredInsumos = insumos.filter(ins => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ins.codigo?.toLowerCase().includes(term) ||
      ins.descricao?.toLowerCase().includes(term)
    );
  });

  const handleAdd = () => {
    if (!selectedInsumo || !coeficiente || parseFloat(coeficiente) <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    addMutation.mutate({ coeficiente, observacao });
  };

  const handleEdit = (item, field, value) => {
    setEditingItem(prev => ({
      ...prev,
      id: item.id,
      [field]: value
    }));
  };

  const handleSaveEdit = (id) => {
    if (!editingItem || editingItem.id !== id) return;
    
    updateMutation.mutate({ 
      id, 
      data: {
        coeficiente: parseFloat(editingItem.coeficiente),
        observacao: editingItem.observacao
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Insumos da Composição</DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            {composicao?.codigo} - {composicao?.descricao}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Adicionar Insumo */}
          {!isAdding ? (
            <Button onClick={() => setIsAdding(true)} className="w-full" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Insumo
            </Button>
          ) : (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">Novo Insumo</h4>
                <Button onClick={() => { setIsAdding(false); setSelectedInsumo(null); }} variant="ghost" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Busca de Insumo */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar insumo por código ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Lista de Insumos */}
              {searchTerm && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {filteredInsumos.slice(0, 10).map(ins => (
                    <div
                      key={ins.id}
                      onClick={() => {
                        setSelectedInsumo(ins);
                        setSearchTerm('');
                      }}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-sm text-gray-600">{ins.codigo}</p>
                          <p className="text-sm text-gray-900">{ins.descricao}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={
                            ins.tipo === 'material' ? 'bg-blue-100 text-blue-700' :
                            ins.tipo === 'mao_obra' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-amber-100 text-amber-700'
                          }>
                            {ins.tipo}
                          </Badge>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {(ins.preco_unitario || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredInsumos.length === 0 && (
                    <p className="text-center py-4 text-gray-500 text-sm">Nenhum insumo encontrado</p>
                  )}
                </div>
              )}

              {/* Insumo Selecionado */}
              {selectedInsumo && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <p className="font-mono text-sm text-gray-600">{selectedInsumo.codigo}</p>
                      <p className="font-semibold text-gray-900">{selectedInsumo.descricao}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{selectedInsumo.unidade}</Badge>
                        <Badge className={
                          selectedInsumo.tipo === 'material' ? 'bg-blue-100 text-blue-700' :
                          selectedInsumo.tipo === 'mao_obra' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-amber-100 text-amber-700'
                        }>
                          {selectedInsumo.tipo}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Preço Unitário</p>
                      <p className="text-xl font-bold text-blue-600">
                        {(selectedInsumo.preco_unitario || 0).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Coeficiente *
                      </label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={coeficiente}
                        onChange={(e) => setCoeficiente(e.target.value)}
                        placeholder="Ex: 1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Custo Parcial
                      </label>
                      <div className="h-9 flex items-center px-3 bg-gray-50 border border-gray-300 rounded-md">
                        <span className="font-semibold text-gray-900">
                          {(parseFloat(coeficiente || 0) * (selectedInsumo.preco_unitario || 0)).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Observação
                    </label>
                    <Input
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Observações sobre o uso deste insumo"
                    />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button 
                      onClick={handleAdd} 
                      className="flex-1"
                      disabled={addMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                    <Button 
                      onClick={() => setSelectedInsumo(null)} 
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de Insumos da Composição */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">
              Insumos ({composicaoInsumos.length})
            </h4>

            {isLoading ? (
              <p className="text-center py-6 text-gray-500">Carregando...</p>
            ) : composicaoInsumos.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">Nenhum insumo cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {composicaoInsumos.map(item => {
                  const isEditing = editingItem?.id === item.id;
                  
                  return (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-mono text-sm text-gray-600">{item.insumo?.codigo}</p>
                            <Badge className={
                              item.insumo?.tipo === 'material' ? 'bg-blue-100 text-blue-700' :
                              item.insumo?.tipo === 'mao_obra' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-amber-100 text-amber-700'
                            }>
                              {item.insumo?.tipo}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-900 font-medium">{item.insumo?.descricao}</p>
                          
                          {isEditing ? (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={editingItem.coeficiente !== undefined ? editingItem.coeficiente : item.coeficiente}
                                onChange={(e) => handleEdit(item, 'coeficiente', e.target.value)}
                                placeholder="Coeficiente"
                                className="text-sm"
                              />
                              <Input
                                value={editingItem.observacao !== undefined ? editingItem.observacao : (item.observacao || '')}
                                onChange={(e) => handleEdit(item, 'observacao', e.target.value)}
                                placeholder="Observação"
                                className="text-sm"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-xs text-gray-600 mt-2">
                                Coeficiente: <span className="font-mono font-semibold">{item.coeficiente?.toFixed(4)}</span> {item.insumo?.unidade}
                              </p>
                              {item.observacao && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {item.observacao}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-gray-600">Preço Unit.</p>
                          <p className="font-semibold text-gray-900">
                            {(item.insumo?.preco_unitario || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}
                          </p>
                          <p className="text-xs text-gray-600 mt-2">Custo Parcial</p>
                          <p className="text-lg font-bold text-blue-600">
                            {(item.custo_parcial || 0).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}
                          </p>

                          <div className="flex gap-1 mt-3 justify-end">
                            {isEditing ? (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSaveEdit(item.id)}
                                  disabled={updateMutation.isPending}
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditingItem(null)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditingItem({ id: item.id, coeficiente: item.coeficiente, observacao: item.observacao })}
                                >
                                  Editar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo */}
          {composicaoInsumos.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Custo Total da Composição:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {composicaoInsumos.reduce((sum, item) => sum + (item.custo_parcial || 0), 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}