import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { GitBranch, Play, Pause, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkflowsAvancado() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'aprovacao',
    entidade_alvo: 'Medicao',
    etapas: [],
    ativo: true
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows-definicao'],
    queryFn: () => base44.entities.WorkflowDefinicao.list()
  });

  const { data: instancias = [] } = useQuery({
    queryKey: ['workflows-instancia'],
    queryFn: () => base44.entities.WorkflowInstancia.filter({ status: 'em_andamento' })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkflowDefinicao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows-definicao']);
      toast.success('Workflow criado!');
      setDialogOpen(false);
      resetForm();
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.WorkflowDefinicao.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries(['workflows-definicao']);
      toast.success('Status atualizado!');
    }
  });

  const aprovarEtapa = async (instanciaId, etapaId) => {
    try {
      await base44.functions.invoke('processarWorkflow', {
        instancia_id: instanciaId,
        etapa_id: etapaId,
        acao: 'aprovar'
      });
      queryClient.invalidateQueries(['workflows-instancia']);
      toast.success('Etapa aprovada!');
    } catch (error) {
      toast.error('Erro ao aprovar');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo: 'aprovacao',
      entidade_alvo: 'Medicao',
      etapas: [],
      ativo: true
    });
  };

  const tiposWorkflow = [
    { value: 'aprovacao', label: 'Aprovação', icon: CheckCircle },
    { value: 'notificacao', label: 'Notificação', icon: Users },
    { value: 'automacao', label: 'Automação', icon: GitBranch }
  ];

  const entidadesAlvo = [
    { value: 'Medicao', label: 'Medições' },
    { value: 'OrdemCompra', label: 'Ordem de Compra' },
    { value: 'ContaFinanceira', label: 'Contas Financeiras' },
    { value: 'RequisicaoCompra', label: 'Requisição de Compra' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflows e Aprovações</h1>
          <p className="text-gray-600 mt-1">Configure fluxos de trabalho automatizados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <GitBranch className="w-4 h-4" />
              Novo Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Workflow</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Nome do Workflow</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Aprovação de Medição"
                />
              </div>
              
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposWorkflow.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Aplicar em</Label>
                <Select
                  value={formData.entidade_alvo}
                  onValueChange={(value) => setFormData({ ...formData, entidade_alvo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entidadesAlvo.map(entidade => (
                      <SelectItem key={entidade.value} value={entidade.value}>
                        {entidade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => createMutation.mutate(formData)}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              Workflows Configurados
            </CardTitle>
            <CardDescription>
              {workflows.length} workflows ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{workflow.nome}</h3>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{workflow.tipo}</Badge>
                      <Badge variant="outline">{workflow.entidade_alvo}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={workflow.ativo ? "default" : "outline"}
                      onClick={() => toggleMutation.mutate({
                        id: workflow.id,
                        ativo: !workflow.ativo
                      })}
                    >
                      {workflow.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
              {workflows.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum workflow configurado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Aprovações Pendentes
            </CardTitle>
            <CardDescription>
              {instancias.length} aprovações aguardando
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {instancias.map((instancia) => (
                <div
                  key={instancia.id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div>
                    <h3 className="font-semibold">{instancia.workflow_nome}</h3>
                    <p className="text-sm text-gray-600">
                      {instancia.entidade_tipo} #{instancia.entidade_id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => aprovarEtapa(instancia.id, instancia.etapa_atual)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
              {instancias.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhuma aprovação pendente
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}