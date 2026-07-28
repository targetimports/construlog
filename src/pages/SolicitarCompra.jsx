import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import GuardObraObrigatoria from '@/components/layout/GuardObraObrigatoria';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';

export default function SolicitarCompra() {
  return (
    <GuardObraObrigatoria>
      <SolicitarCompraContent />
    </GuardObraObrigatoria>
  );
}

function SolicitarCompraContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { obraAtual } = useGlobalContext();
  const [itens, setItens] = useState([{ descricao: '', quantidade: 1, unidade: 'un' }]);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao_resumo: '',
    obra_id: obraAtual?.id || '',
    prioridade: 'normal',
    data_necessidade: '',
    justificativa: ''
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: minhasSolicitacoes = [] } = useQuery({
    queryKey: ['minhas-solicitacoes', user?.email],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ solicitante: user.email }, '-created_date'),
    enabled: !!user?.email
  });

  const criarSolicitacaoMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.RequisicaoCompra.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['minhas-solicitacoes']);
      toast.success('Solicitação enviada com sucesso!');
      // Reset form
      setFormData({
        titulo: '',
        descricao_resumo: '',
        obra_id: '',
        prioridade: 'normal',
        data_necessidade: '',
        justificativa: ''
      });
      setItens([{ descricao: '', quantidade: 1, unidade: 'un' }]);
    },
    onError: (error) => {
      toast.error('Erro ao criar solicitação: ' + error.message);
    }
  });

  const handleAddItem = () => {
    setItens([...itens, { descricao: '', quantidade: 1, unidade: 'un' }]);
  };

  const handleRemoveItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItens = [...itens];
    newItens[index][field] = value;
    setItens(newItens);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!obraAtual?.id) {
      toast.error('Selecione uma obra antes de continuar');
      return;
    }

    if (!formData.titulo) {
      toast.error('Preencha o título da solicitação');
      return;
    }

    if (itens.filter(i => i.descricao).length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    const requisicao = {
      ...formData,
      obra_id: obraAtual.id,
      solicitante: user.email,
      data_solicitacao: new Date().toISOString().split('T')[0],
      status: 'aguardando',
      status_aprovacao: 'pendente',
      itens: itens.filter(i => i.descricao).map(item => ({
        descricao: item.descricao,
        quantidade_solicitada: parseFloat(item.quantidade) || 1,
        unidade: item.unidade,
        status: 'em_aberto'
      }))
    };

    criarSolicitacaoMutation.mutate(requisicao);
  };

  const getStatusBadge = (status) => {
    const config = {
      pendente: { label: 'Aguardando Aprovação', color: 'bg-amber-500 text-white', icon: Clock },
      aprovada: { label: 'Aprovada', color: 'bg-green-500 text-white', icon: CheckCircle2 },
      recusada: { label: 'Recusada', color: 'bg-red-500 text-white', icon: XCircle }
    };
    const { label, color, icon: Icon } = config[status] || config.pendente;
    return (
      <Badge className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitar Compra de Equipamentos"
        subtitle="Envie sua solicitação para aprovação do administrador"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Nova Solicitação</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Título da Solicitação *
                    </label>
                    <Input
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      placeholder="Ex: Equipamentos para obra"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Obra/Centro de Custo
                    </label>
                    <Select value={formData.obra_id} onValueChange={(value) => setFormData({ ...formData, obra_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {obras.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Descrição Resumida
                  </label>
                  <Textarea
                    value={formData.descricao_resumo}
                    onChange={(e) => setFormData({ ...formData, descricao_resumo: e.target.value })}
                    placeholder="Descreva brevemente o que está solicitando"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Prioridade
                    </label>
                    <Select value={formData.prioridade} onValueChange={(value) => setFormData({ ...formData, prioridade: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      Data de Necessidade
                    </label>
                    <Input
                      type="date"
                      value={formData.data_necessidade}
                      onChange={(e) => setFormData({ ...formData, data_necessidade: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Justificativa
                  </label>
                  <Textarea
                    value={formData.justificativa}
                    onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
                    placeholder="Explique o motivo da solicitação"
                    rows={3}
                  />
                </div>

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Itens Solicitados</h3>
                    <Button type="button" onClick={handleAddItem} variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {itens.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                        <div className="flex-1">
                          <Input
                            value={item.descricao}
                            onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                            placeholder="Descrição do equipamento"
                          />
                        </div>
                        <div className="w-28">
                          <Input
                            type="number"
                            value={item.quantidade}
                            onChange={(e) => handleItemChange(index, 'quantidade', e.target.value)}
                            placeholder="Qtd"
                            min="1"
                          />
                        </div>
                        <div className="w-24">
                          <Select value={item.unidade} onValueChange={(value) => handleItemChange(index, 'unidade', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="un">Un</SelectItem>
                              <SelectItem value="kg">Kg</SelectItem>
                              <SelectItem value="m">M</SelectItem>
                              <SelectItem value="m2">M²</SelectItem>
                              <SelectItem value="cx">Cx</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {itens.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={criarSolicitacaoMutation.isPending}>
                    {criarSolicitacaoMutation.isPending ? 'Enviando...' : 'Enviar Solicitação'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Minhas Solicitações */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Minhas Solicitações</CardTitle>
            </CardHeader>
            <CardContent>
              {minhasSolicitacoes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Nenhuma solicitação ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {minhasSolicitacoes.slice(0, 10).map(sol => (
                    <div key={sol.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-sm text-gray-900">{sol.titulo}</h4>
                        {getStatusBadge(sol.status_aprovacao)}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{sol.descricao_resumo}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{sol.itens?.length || 0} itens</span>
                        <span>{new Date(sol.created_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {sol.motivo_recusa && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <strong>Motivo da recusa:</strong> {sol.motivo_recusa}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}