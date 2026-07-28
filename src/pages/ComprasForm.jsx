import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save, AlertCircle, Package, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const UNIDADES = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'm', label: 'Metro' },
  { value: 'm2', label: 'Metro Quadrado' },
  { value: 'm3', label: 'Metro Cúbico' },
  { value: 'l', label: 'Litro' },
  { value: 'sc', label: 'Saco' },
  { value: 'cx', label: 'Caixa' },
];

export default function ComprasForm() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const obraIdUrl = urlParams.get('obra_id') || '';
  const orcamentoIdUrl = urlParams.get('orcamento_id') || '';
  const [formData, setFormData] = useState({
    obra_id: obraIdUrl,
    orcamento_id: orcamentoIdUrl,
    data_necessidade: '',
    prioridade: 'media',
    solicitante: '',
    observacoes: ''
  });
  const [itens, setItens] = useState([]);
  const [materialSelecionado, setMaterialSelecionado] = useState(null);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me().catch(() => ({}));
      const solicitanteNome = data.solicitante || user.full_name || user.nome || user.email || 'Solicitante';
      const itensArray = itens.map(item => ({
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade_solicitada: Number(item.quantidade),
        valor_estimado: Number(item.valor_estimado || 0)
      }));
      const valorTotal = itens.reduce((sum, item) => sum + (Number(item.quantidade) * Number(item.valor_estimado || 0)), 0);
      const resumo = itens.length > 0 ? `${itens[0].descricao}${itens.length > 1 ? ` e mais ${itens.length - 1} itens` : ''}` : 'Requisição';

      return base44.entities.RequisicaoCompra.create({
        ...data,
        solicitante: solicitanteNome,
        solicitante_nome: solicitanteNome,
        titulo: `Solicitação de ${solicitanteNome}`,
        data_solicitacao: new Date().toISOString(),
        descricao_resumo: resumo,
        itens: itensArray,
        valor_total_estimado: valorTotal,
        qtd_itens: itens.length,
        status: 'aguardando',
        status_aprovacao: 'pendente'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Requisição criada!');
      window.location.href = createPageUrl('Compras');
    },
    onError: (error) => {
      toast.error('Erro ao criar requisição: ' + (error?.message || 'tente novamente'));
    }
  });

  const handleAddItem = () => {
    const novoItem = {
      id: Date.now(),
      descricao: '',
      categoria: 'materiais',
      quantidade: '',
      unidade: 'un',
      valor_estimado: ''
    };
    setItens([...itens, novoItem]);
  };

  const handleRemoveItem = (id) => {
    setItens(itens.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id, field, value) => {
    setItens(itens.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }
    if (!formData.obra_id) {
      toast.error('Selecione uma obra');
      return;
    }
    createMutation.mutate(formData);
  };

  const totalGeral = itens.reduce((sum, item) => sum + (Number(item.quantidade) * Number(item.valor_estimado || 0)), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="hover:bg-slate-200 text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-8 h-8 text-blue-600" />
              Nova Requisição de Compra
            </h1>
            <p className="text-slate-500 text-sm mt-1">Preencha os dados abaixo para criar uma nova requisição</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
           {/* Card Informações Gerais */}
           <Card className="bg-white border-slate-200 shadow-sm">
             <CardHeader className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
               <CardTitle className="text-slate-900 flex items-center gap-2">
                 <div className="w-1 h-6 bg-blue-600 rounded"></div>
                 Informações da Requisição
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-6 space-y-6">
               <div className="grid grid-cols-2 gap-6">
                 {/* Obra */}
                 <div>
                   <Label className="text-slate-700 font-semibold">Obra *</Label>
                   <Select value={formData.obra_id} onValueChange={(v) => setFormData({ ...formData, obra_id: v })}>
                     <SelectTrigger className="mt-2 bg-white border-slate-300">
                       <SelectValue placeholder="Selecione a obra" />
                     </SelectTrigger>
                     <SelectContent>
                       {obras.map(obra => (
                         <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>

                 {/* Data */}
                 <div>
                   <Label className="text-slate-700 font-semibold">Data Necessidade *</Label>
                   <Input
                     type="date"
                     value={formData.data_necessidade}
                     onChange={(e) => setFormData({ ...formData, data_necessidade: e.target.value })}
                     required
                     className="mt-2 bg-white border-slate-300"
                   />
                 </div>

                 {/* Prioridade */}
                 <div>
                   <Label className="text-slate-700 font-semibold">Prioridade</Label>
                   <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                     <SelectTrigger className="mt-2 bg-white border-slate-300">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="baixa">Baixa</SelectItem>
                       <SelectItem value="media">Média</SelectItem>
                       <SelectItem value="alta">Alta</SelectItem>
                       <SelectItem value="urgente">Urgente</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 {/* Solicitante */}
                 <div>
                   <Label className="text-slate-700 font-semibold">Solicitante</Label>
                   <Input
                     value={formData.solicitante}
                     onChange={(e) => setFormData({ ...formData, solicitante: e.target.value })}
                     placeholder="Seu nome"
                     className="mt-2 bg-white border-slate-300"
                   />
                 </div>

                 {/* Observações */}
                 <div className="col-span-2">
                   <Label className="text-slate-700 font-semibold">Observações</Label>
                   <Textarea
                     value={formData.observacoes}
                     onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                     className="mt-2 bg-white border-slate-300"
                     placeholder="Adicione informações adicionais..."
                     rows={3}
                   />
                 </div>
               </div>
             </CardContent>
           </Card>

           {/* Card Items */}
           <Card className="bg-white border-slate-200 shadow-sm">
             <CardHeader className="bg-gradient-to-r from-green-50 to-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
               <CardTitle className="text-slate-900 flex items-center gap-2">
                 <div className="w-1 h-6 bg-green-600 rounded"></div>
                 Itens da Requisição ({itens.length})
               </CardTitle>
               <Button
                 type="button"
                 onClick={handleAddItem}
                 size="sm"
                 className="bg-green-600 hover:bg-green-700 text-white gap-2"
               >
                 <Plus className="w-4 h-4" />
                 Adicionar Item
               </Button>
             </CardHeader>
             <CardContent className="pt-6">
               {itens.length === 0 ? (
                 <div className="text-center py-8 text-gray-500">
                   <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                   <p>Nenhum item adicionado ainda. Clique em "Adicionar Item" para começar</p>
                 </div>
               ) : (
                 <div className="space-y-4">
              {itens.map((item, index) => (
                <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  {/* Header do Item */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">Item {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Descrição + Material Rápido */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-slate-600 font-semibold">Descrição *</Label>
                      <Input
                        value={item.descricao}
                        onChange={(e) => handleUpdateItem(item.id, 'descricao', e.target.value)}
                        placeholder="Nome do item"
                        required
                        className="mt-1 bg-white border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 font-semibold">Selecionar Material</Label>
                      <Select 
                        onValueChange={(materialId) => {
                          const material = materiais.find(m => m.id === materialId);
                          if (material) {
                            handleUpdateItem(item.id, 'descricao', material.nome);
                            handleUpdateItem(item.id, 'unidade', material.unidade);
                            handleUpdateItem(item.id, 'valor_estimado', material.preco_medio || '');
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 bg-white border-slate-300 text-sm">
                          <SelectValue placeholder="Material..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materiais.map(mat => (
                            <SelectItem key={mat.id} value={mat.id}>
                              {mat.nome} • R$ {(mat.preco_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Quantidade + Unidade */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-xs text-slate-600 font-semibold">Quantidade *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantidade}
                        onChange={(e) => handleUpdateItem(item.id, 'quantidade', e.target.value)}
                        placeholder="0.00"
                        required
                        className="mt-1 bg-white border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 font-semibold">Unidade *</Label>
                      <Select value={item.unidade} onValueChange={(v) => handleUpdateItem(item.id, 'unidade', v)}>
                        <SelectTrigger className="mt-1 bg-white border-slate-300 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(un => (
                            <SelectItem key={un.value} value={un.value}>{un.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 font-semibold">Valor Unitário (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.valor_estimado}
                        onChange={(e) => handleUpdateItem(item.id, 'valor_estimado', e.target.value)}
                        placeholder="0.00"
                        className="mt-1 bg-white border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 font-semibold">Total (R$)</Label>
                      <div className="mt-1 p-2 bg-white border border-slate-300 rounded text-sm font-semibold text-slate-900">
                        R$ {((Number(item.quantidade) || 0) * (Number(item.valor_estimado) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              )}

              {/* Total Geral */}
              {itens.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <span className="text-slate-700 font-semibold">Valor Total da Requisição:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              </CardContent>
              </Card>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.href = createPageUrl('Compras')}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <Save className="w-4 h-4" />
                {createMutation.isPending ? 'Criando...' : 'Criar Requisição'}
              </Button>
              </div>
              </form>
              </div>
              </div>
              );
              }