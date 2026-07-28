import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Edit2, FileText, AlertTriangle } from 'lucide-react';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function RelatoriosAutomaticos() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({
    titulo: '',
    tipo: 'completo',
    frequencia: 'mensal',
    dia_mes: 1,
    dia_semana: 1,
    hora_envio: '09:00',
    destinatarios: ''
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ['relatorios-agendados'],
    queryFn: () => base44.entities.RelatorioAgendado.list()
  });

  const criarRelatorioMutation = useMutation({
    mutationFn: (data) => base44.entities.RelatorioAgendado.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatorios-agendados'] });
      toast.success('Relatório agendado com sucesso!');
      setOpenDialog(false);
      resetForm();
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.RelatorioAgendado.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatorios-agendados'] });
      toast.success('Relatório removido');
    }
  });

  const gerarAgora = async (tipo) => {
    try {
      const { data } = await base44.functions.invoke('gerarRelatorioIA', {
        tipo: tipo
      });

      toast.success('Relatório gerado com sucesso!');
      console.log('Relatório:', data.conteudo);
      
      // Aqui poderia abrir um modal com o relatório
    } catch (error) {
      toast.error('Erro ao gerar: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      tipo: 'completo',
      frequencia: 'mensal',
      dia_mes: 1,
      dia_semana: 1,
      hora_envio: '09:00',
      destinatarios: ''
    });
    setEditando(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      toast.error('Digite um título');
      return;
    }

    const destinatarios = formData.destinatarios
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

    if (destinatarios.length === 0) {
      toast.error('Adicione pelo menos um destinatário');
      return;
    }

    criarRelatorioMutation.mutate({
      ...formData,
      destinatarios: destinatarios,
      ativo: true,
      configuracao: {
        incluir_graficos: true,
        incluir_alertas_criticos: true,
        incluir_recomendacoes_ia: true
      }
    });
  };

  if (!user || !['admin', 'programador'].includes(user.role) && user.acesso_global !== true) {
    return (
      <div className="p-6">
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Apenas administradores podem acessar essa página
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios Automáticos</h1>
          <p className="text-gray-600 mt-2">Configure relatórios periódicos com IA</p>
        </div>
        <Button 
          onClick={() => setOpenDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Relatório
        </Button>
      </div>

      {/* Gerar Agora */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Gerar Relatório Agora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button 
              onClick={() => gerarAgora('financeiro')}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Financeiro
            </Button>
            <Button 
              onClick={() => gerarAgora('frota')}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Frota
            </Button>
            <Button 
              onClick={() => gerarAgora('alertas')}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Alertas
            </Button>
            <Button 
              onClick={() => gerarAgora('estoque')}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Estoque
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Relatórios Agendados */}
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : relatorios.length === 0 ? (
        <Card>
          <CardContent className="pt-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum relatório agendado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {relatorios.map(rel => (
            <Card key={rel.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{rel.titulo}</h3>
                    <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-gray-600">
                      <div>Tipo: <span className="font-mono">{rel.tipo}</span></div>
                      <div>Frequência: <span className="font-mono">{rel.frequencia}</span></div>
                      <div>Horário: <span className="font-mono">{rel.hora_envio}</span></div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-gray-600">{rel.destinatarios.join(', ')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => deletarMutation.mutate(rel.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Novo Relatório */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Novo Relatório</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input
                placeholder="Ex: Relatório Semanal de Gestão"
                value={formData.titulo}
                onChange={(e) => setFormData({...formData, titulo: e.target.value})}
              />
            </div>

            <div>
              <Label>Tipo de Relatório</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({...formData, tipo: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="frota">Frota</SelectItem>
                  <SelectItem value="alertas">Alertas Críticos</SelectItem>
                  <SelectItem value="estoque">Estoque</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequência</Label>
              <Select value={formData.frequencia} onValueChange={(value) => setFormData({...formData, frequencia: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.frequencia === 'semanal' && (
              <div>
                <Label>Dia da Semana</Label>
                <Select value={formData.dia_semana.toString()} onValueChange={(value) => setFormData({...formData, dia_semana: parseInt(value)})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Segunda</SelectItem>
                    <SelectItem value="2">Terça</SelectItem>
                    <SelectItem value="3">Quarta</SelectItem>
                    <SelectItem value="4">Quinta</SelectItem>
                    <SelectItem value="5">Sexta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.frequencia === 'mensal' && (
              <div>
                <Label>Dia do Mês</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dia_mes}
                  onChange={(e) => setFormData({...formData, dia_mes: parseInt(e.target.value)})}
                />
              </div>
            )}

            <div>
              <Label>Horário de Envio</Label>
              <Input
                type="time"
                value={formData.hora_envio}
                onChange={(e) => setFormData({...formData, hora_envio: e.target.value})}
              />
            </div>

            <div>
              <Label>Destinatários (separados por vírgula)</Label>
              <Input
                placeholder="email@exemplo.com, outro@exemplo.com"
                value={formData.destinatarios}
                onChange={(e) => setFormData({...formData, destinatarios: e.target.value})}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Agendar
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenDialog(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}