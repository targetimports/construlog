import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, CheckSquare, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SeletorTemplateChecklist({ open, onOpenChange, onSelecionar }) {
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-checklist'],
    queryFn: () => base44.entities.TemplateChecklist.filter({ ativo: true })
  });

  const categoriaConfig = {
    vistoria_obra: { label: 'Vistoria de Obra', icon: '' },
    seguranca: { label: 'Segurança', icon: '' },
    qualidade: { label: 'Qualidade', icon: '✓' },
    entrega: { label: 'Entrega', icon: '' },
    manutencao: { label: 'Manutenção', icon: '' },
    inspeção: { label: 'Inspeção', icon: '' },
    custom: { label: 'Personalizado', icon: '' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-purple-500" />
            Selecionar Template de Checklist
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="grid grid-cols-2 gap-3">
            {templates.map(template => (
              <Card
                key={template.id}
                className="bg-gray-800 border-gray-700 cursor-pointer hover:border-purple-500 transition-all"
                onClick={() => {
                  onSelecionar(template);
                  onOpenChange(false);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-2xl mb-2">
                        {categoriaConfig[template.categoria]?.icon}
                      </div>
                      <h4 className="text-white font-medium mb-1">{template.nome}</h4>
                      <Badge className="bg-purple-500/10 text-purple-400">
                        {categoriaConfig[template.categoria]?.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {template.descricao && (
                    <p className="text-gray-400 text-sm mb-2">{template.descricao}</p>
                  )}
                  <div className="text-xs text-gray-500">
                    {template.itens?.length || 0} itens • Usado {template.uso_count || 0}x
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-400"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GerenciarTemplatesChecklist({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [modoEdicao, setModoEdicao] = useState(false);
  const [templateAtual, setTemplateAtual] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'custom',
    descricao: '',
    itens: []
  });
  const [novoItemTexto, setNovoItemTexto] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-checklist'],
    queryFn: () => base44.entities.TemplateChecklist.list()
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.TemplateChecklist.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates-checklist']);
      toast.success('Template criado!');
      limparForm();
    }
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TemplateChecklist.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates-checklist']);
      toast.success('Template atualizado!');
      limparForm();
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.TemplateChecklist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['templates-checklist']);
      toast.success('Template excluído!');
    }
  });

  const adicionarItem = () => {
    if (!novoItemTexto.trim()) return;
    setFormData({
      ...formData,
      itens: [...formData.itens, { texto: novoItemTexto, obrigatorio: true }]
    });
    setNovoItemTexto('');
  };

  const removerItem = (index) => {
    setFormData({
      ...formData,
      itens: formData.itens.filter((_, i) => i !== index)
    });
  };

  const toggleObrigatorio = (index) => {
    const novosItens = [...formData.itens];
    novosItens[index].obrigatorio = !novosItens[index].obrigatorio;
    setFormData({ ...formData, itens: novosItens });
  };

  const limparForm = () => {
    setFormData({ nome: '', categoria: 'custom', descricao: '', itens: [] });
    setModoEdicao(false);
    setTemplateAtual(null);
  };

  const editarTemplate = (template) => {
    setTemplateAtual(template);
    setFormData({
      nome: template.nome,
      categoria: template.categoria,
      descricao: template.descricao || '',
      itens: template.itens || []
    });
    setModoEdicao(true);
  };

  const handleSalvar = () => {
    if (!formData.nome || formData.itens.length === 0) {
      toast.error('Preencha nome e adicione pelo menos 1 item');
      return;
    }

    if (templateAtual) {
      atualizarMutation.mutate({ id: templateAtual.id, data: formData });
    } else {
      criarMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-purple-500" />
            Gerenciar Templates de Checklist
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Lista de Templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Templates Salvos</h3>
              <Button
                size="sm"
                onClick={() => {
                  limparForm();
                  setModoEdicao(true);
                }}
                className="bg-purple-500 hover:bg-purple-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                Novo
              </Button>
            </div>
            
            <ScrollArea className="h-[500px]">
              <div className="space-y-2 pr-4">
                {templates.map(template => (
                  <Card key={template.id} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm mb-1">{template.nome}</h4>
                          <div className="text-xs text-gray-400">
                            {template.itens?.length || 0} itens
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => editarTemplate(template)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletarMutation.mutate(template.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Formulário */}
          <div>
            <h3 className="text-white font-medium mb-3">
              {templateAtual ? 'Editar Template' : 'Novo Template'}
            </h3>

            {modoEdicao ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400 text-sm">Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white mt-1"
                    placeholder="Ex: Vistoria de Alvenaria"
                  />
                </div>

                <div>
                  <Label className="text-gray-400 text-sm">Categoria</Label>
                  <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="vistoria_obra">Vistoria de Obra</SelectItem>
                      <SelectItem value="seguranca">Segurança</SelectItem>
                      <SelectItem value="qualidade">Qualidade</SelectItem>
                      <SelectItem value="entrega">Entrega</SelectItem>
                      <SelectItem value="manutencao">Manutenção</SelectItem>
                      <SelectItem value="inspeção">Inspeção</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-400 text-sm">Itens do Checklist *</Label>
                  <div className="flex gap-2 mt-1 mb-2">
                    <Input
                      value={novoItemTexto}
                      onChange={(e) => setNovoItemTexto(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && adicionarItem()}
                      className="bg-gray-800 border-gray-700 text-white flex-1"
                      placeholder="Digite um item e pressione Enter"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={adicionarItem}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <ScrollArea className="h-[250px] border border-gray-700 rounded-lg p-2">
                    <div className="space-y-2">
                      {formData.itens.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                          <Checkbox
                            checked={item.obrigatorio}
                            onCheckedChange={() => toggleObrigatorio(idx)}
                          />
                          <span className="flex-1 text-sm text-gray-300">{item.texto}</span>
                          <button
                            onClick={() => removerItem(idx)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={limparForm}
                    className="border-gray-700 text-gray-400 flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSalvar}
                    disabled={criarMutation.isPending || atualizarMutation.isPending}
                    className="bg-purple-500 hover:bg-purple-600 flex-1"
                  >
                    {templateAtual ? 'Atualizar' : 'Criar'} Template
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Selecione um template para editar ou clique em "Novo"
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}