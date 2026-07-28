import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoWorkflows() {
  const [modalAberto, setModalAberto] = useState(false);
  const [workflowEditando, setWorkflowEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo_entidade: 'RequisicaoCompra',
    criterios: {
      valor_minimo: 0,
      valor_maximo: null,
      tipos_material: [],
      obras_ids: [],
      prioridades: []
    },
    etapas: [],
    ativa: true,
    prioridade: 0
  });
  const queryClient = useQueryClient();

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows-aprovacao'],
    queryFn: () => base44.entities.WorkflowAprovacao.list('-prioridade')
  });

  const { data: alcadas = [] } = useQuery({
    queryKey: ['alcadas-aprovacao'],
    queryFn: () => base44.entities.AlcadaAprovacao.list()
  });

  const salvaMutation = useMutation({
    mutationFn: async (dados) => {
      if (workflowEditando?.id) {
        return base44.entities.WorkflowAprovacao.update(workflowEditando.id, dados);
      } else {
        return base44.entities.WorkflowAprovacao.create(dados);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows-aprovacao'] });
      toast.success('Workflow salvo com sucesso');
      resetForm();
      setModalAberto(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const deletaMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowAprovacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows-aprovacao'] });
      toast.success('Workflow removido');
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      tipo_entidade: 'RequisicaoCompra',
      criterios: {
        valor_minimo: 0,
        valor_maximo: null,
        tipos_material: [],
        obras_ids: [],
        prioridades: []
      },
      etapas: [],
      ativa: true,
      prioridade: 0
    });
    setWorkflowEditando(null);
  };

  const handleAdicionarEtapa = () => {
    const novaEtapa = {
      numero: (formData.etapas?.length || 0) + 1,
      alcada_id: '',
      alcada_nome: '',
      requer_todos: false,
      pode_pular: false
    };
    setFormData({
      ...formData,
      etapas: [...(formData.etapas || []), novaEtapa]
    });
  };

  const handleRemoverEtapa = (idx) => {
    const novasEtapas = formData.etapas.filter((_, i) => i !== idx);
    // Renumerar
    novasEtapas.forEach((e, i) => { e.numero = i + 1; });
    setFormData({ ...formData, etapas: novasEtapas });
  };

  const handleSalvar = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome do workflow é obrigatório');
      return;
    }
    if (!formData.etapas || formData.etapas.length === 0) {
      toast.error('Adicione pelo menos uma etapa');
      return;
    }
    salvaMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Workflows de Aprovação</h2>
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{workflowEditando ? 'Editar' : 'Novo'} Workflow</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Dados Básicos */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Informações Básicas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome</label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      placeholder="ex: Aprovação até R$ 50k"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo</label>
                    <select
                      value={formData.tipo_entidade}
                      onChange={(e) => setFormData({...formData, tipo_entidade: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="RequisicaoCompra">Requisição de Compra</option>
                      <option value="OrdemCompra">Ordem de Compra</option>
                      <option value="Medicao">Medição</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    placeholder="Descreva quando este workflow se aplica"
                    className="min-h-20"
                  />
                </div>
              </div>

              {/* Critérios */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">Critérios de Aplicação</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor Mínimo (R$)</label>
                    <Input
                      type="number"
                      value={formData.criterios.valor_minimo || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        criterios: {...formData.criterios, valor_minimo: parseFloat(e.target.value)}
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor Máximo (R$)</label>
                    <Input
                      type="number"
                      value={formData.criterios.valor_maximo || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        criterios: {...formData.criterios, valor_maximo: e.target.value ? parseFloat(e.target.value) : null}
                      })}
                      placeholder="Deixe vazio para sem limite"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={formData.ativa}
                      onCheckedChange={(checked) => setFormData({...formData, ativa: checked})}
                    />
                    Ativo
                  </label>
                </div>
              </div>

              {/* Etapas */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Etapas de Aprovação</h3>
                  <Button size="sm" onClick={handleAdicionarEtapa} variant="outline">
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar Etapa
                  </Button>
                </div>

                {formData.etapas.map((etapa, idx) => (
                  <div key={idx} className="border rounded p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-sm">Etapa {etapa.numero}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoverEtapa(idx)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Alçada</label>
                        <select
                          value={etapa.alcada_id}
                          onChange={(e) => {
                            const alcada = alcadas.find(a => a.id === e.target.value);
                            const novasEtapas = [...formData.etapas];
                            novasEtapas[idx].alcada_id = e.target.value;
                            novasEtapas[idx].alcada_nome = alcada?.nome || '';
                            setFormData({...formData, etapas: novasEtapas});
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded"
                        >
                          <option value="">Selecione uma alçada</option>
                          {alcadas.map(alcada => (
                            <option key={alcada.id} value={alcada.id}>
                              {alcada.nome} (Nível {alcada.nivel})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={etapa.requer_todos || false}
                            onCheckedChange={(checked) => {
                              const novasEtapas = [...formData.etapas];
                              novasEtapas[idx].requer_todos = checked;
                              setFormData({...formData, etapas: novasEtapas});
                            }}
                          />
                          Requer TODOS
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 border-t pt-4">
                <Button variant="outline" onClick={() => setModalAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSalvar}
                  disabled={salvaMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {salvaMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Workflow'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {workflows.map(workflow => (
          <Card key={workflow.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{workflow.nome}</h3>
                    {!workflow.ativa && (
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Inativo</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{workflow.descricao}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setWorkflowEditando(workflow);
                    setFormData(workflow);
                    setModalAberto(true);
                  }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deletaMutation.mutate(workflow.id)}
                    disabled={deletaMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Etapas: </span>
                  {workflow.etapas?.length || 0}
                </p>
                {workflow.etapas?.map(etapa => (
                  <div key={etapa.numero} className="text-sm text-gray-600 ml-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                      {etapa.numero}
                    </span>
                    <span>{etapa.alcada_nome}</span>
                    {etapa.requer_todos && <span className="text-xs text-blue-600">(TODOS)</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}