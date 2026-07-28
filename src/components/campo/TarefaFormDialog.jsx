import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Users, Link2, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { FilaSincronizacao } from './FilaSincronizacao';
import GerenciarDependencias from './GerenciarDependencias';
import { SeletorTemplateChecklist } from './TemplatesChecklist';

export default function TarefaFormDialog({ open, onOpenChange, obraId, tarefaPai = null }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'tarefa',
    prioridade: 'normal',
    data_prazo: '',
    responsaveis: [],
    dependencias: [],
    itens_checklist: []
  });
  const [emailInput, setEmailInput] = useState('');
  const [dialogDependencias, setDialogDependencias] = useState(false);
  const [dialogTemplates, setDialogTemplates] = useState(false);

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.filter({ status: 'ativo' }),
    enabled: open
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
    enabled: open
  });

  const criarTarefaMutation = useMutation({
    mutationFn: (data) => base44.entities.TarefaCampo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tarefas-campo']);
      toast.success('Tarefa criada!');
      onOpenChange(false);
      limparForm();
    }
  });

  const adicionarResponsavel = (email) => {
    if (email && !formData.responsaveis.includes(email)) {
      setFormData({ ...formData, responsaveis: [...formData.responsaveis, email] });
      setEmailInput('');
    }
  };

  const removerResponsavel = (email) => {
    setFormData({
      ...formData,
      responsaveis: formData.responsaveis.filter(e => e !== email)
    });
  };

  const limparForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: 'tarefa',
      prioridade: 'normal',
      data_prazo: '',
      responsaveis: [],
      dependencias: [],
      itens_checklist: []
    });
    setEmailInput('');
  };

  const aplicarTemplate = (template) => {
    setFormData({
      ...formData,
      titulo: template.nome,
      tipo: 'checklist',
      itens_checklist: template.itens.map(item => ({
        texto: item.texto,
        concluido: false,
        obrigatorio: item.obrigatorio
      })),
      template_checklist_id: template.id
    });
    
    // Incrementar contador de uso
    base44.entities.TemplateChecklist.update(template.id, {
      uso_count: (template.uso_count || 0) + 1
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.titulo) {
      toast.error('Digite um título');
      return;
    }

    const dadosTarefa = {
      ...formData,
      obra_id: obraId,
      tarefa_pai_id: tarefaPai?.id || null,
      responsavel: formData.responsaveis[0] || null,
      status: 'pendente'
    };

    if (navigator.onLine) {
      criarTarefaMutation.mutate(dadosTarefa);
    } else {
      FilaSincronizacao.adicionar('tarefa_campo', dadosTarefa);
      toast.info('Tarefa salva offline');
      onOpenChange(false);
      limparForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {tarefaPai ? `Nova Subtarefa de "${tarefaPai.titulo}"` : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-400">Título *</Label>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="Digite o título da tarefa..."
            />
          </div>

          <div>
            <Label className="text-gray-400">Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="Detalhes da tarefa..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="tarefa">Tarefa</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-400">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Prazo</Label>
            <Input
              type="date"
              value={formData.data_prazo}
              onChange={(e) => setFormData({ ...formData, data_prazo: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
            />
          </div>

          <div>
            <Label className="text-gray-400 flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" />
              Responsáveis
            </Label>
            
            <div className="flex gap-2 mb-2">
              <Select value={emailInput} onValueChange={adicionarResponsavel}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white flex-1">
                  <SelectValue placeholder="Selecionar usuário..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {usuarios.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {formData.responsaveis.map(email => (
                <Badge key={email} className="bg-blue-500/10 text-blue-400 border-blue-500/20 gap-2">
                  {usuarios.find(u => u.email === email)?.full_name || email}
                  <button
                    type="button"
                    onClick={() => removerResponsavel(email)}
                    className="hover:bg-blue-500/20 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-gray-400 mb-2 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Dependências
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogDependencias(true)}
                className="border-gray-700 text-gray-400 hover:bg-gray-800 flex-1"
              >
                {formData.dependencias.length > 0 
                  ? `${formData.dependencias.length} ${formData.dependencias.length === 1 ? 'dependência' : 'dependências'}` 
                  : 'Adicionar Dependências'
                }
              </Button>
            </div>
            {formData.dependencias.length > 0 && (
              <p className="text-xs text-amber-400 mt-2">
                Esta tarefa será bloqueada até que as dependências sejam concluídas
              </p>
            )}
          </div>

          {formData.tipo === 'checklist' && (
            <div>
              <Label className="text-gray-400 mb-2 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Template de Checklist
              </Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogTemplates(true)}
                className="border-gray-700 text-purple-400 hover:bg-gray-800 w-full"
              >
                {formData.itens_checklist.length > 0 
                  ? `${formData.itens_checklist.length} itens carregados`
                  : 'Carregar Template'
                }
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-700 text-gray-400"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criarTarefaMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {criarTarefaMutation.isPending ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </DialogFooter>
        </form>

        <GerenciarDependencias
          open={dialogDependencias}
          onOpenChange={setDialogDependencias}
          tarefa={{ ...formData, obra_id: obraId }}
          dependenciasAtuais={formData.dependencias}
          onSalvar={(deps) => setFormData({ ...formData, dependencias: deps })}
        />

        <SeletorTemplateChecklist
          open={dialogTemplates}
          onOpenChange={setDialogTemplates}
          onSelecionar={aplicarTemplate}
        />
      </DialogContent>
    </Dialog>
  );
}