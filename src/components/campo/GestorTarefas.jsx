import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckSquare, Plus, MapPin, Video, Image as ImageIcon, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function GestorTarefas({ obraId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tarefaSelecionada, setTarefaSelecionada] = useState(null);
  const queryClient = useQueryClient();

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas-campo', obraId],
    queryFn: () => base44.entities.TarefaCampo.filter({ obra_id: obraId }, '-created_date', 100)
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.TarefaCampo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tarefas-campo']);
      toast.success('Tarefa criada!');
      setDialogOpen(false);
    }
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TarefaCampo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tarefas-campo']);
      toast.success('Atualizado!');
    }
  });

  const toggleItemChecklist = (tarefa, itemIndex) => {
    const novosItens = [...(tarefa.itens_checklist || [])];
    novosItens[itemIndex] = {
      ...novosItens[itemIndex],
      concluido: !novosItens[itemIndex].concluido,
      data_conclusao: !novosItens[itemIndex].concluido ? new Date().toISOString() : null
    };

    atualizarMutation.mutate({
      id: tarefa.id,
      data: { itens_checklist: novosItens }
    });
  };

  const mudarStatus = (tarefa, novoStatus) => {
    atualizarMutation.mutate({
      id: tarefa.id,
      data: { 
        status: novoStatus,
        data_conclusao: novoStatus === 'concluida' ? new Date().toISOString() : null
      }
    });
  };

  const prioridadeConfig = {
    baixa: { color: 'bg-blue-500/10 text-blue-400', label: 'Baixa' },
    normal: { color: 'bg-gray-500/10 text-gray-400', label: 'Normal' },
    alta: { color: 'bg-amber-500/10 text-amber-400', label: 'Alta' },
    urgente: { color: 'bg-red-500/10 text-red-400', label: 'Urgente' }
  };

  const statusConfig = {
    pendente: { color: 'bg-gray-500/10 text-gray-400', label: 'Pendente' },
    em_andamento: { color: 'bg-blue-500/10 text-blue-400', label: 'Em Andamento' },
    concluida: { color: 'bg-emerald-500/10 text-emerald-400', label: 'Concluída' },
    cancelada: { color: 'bg-red-500/10 text-red-400', label: 'Cancelada' }
  };

  const tarefasPendentes = tarefas.filter(t => t.status !== 'concluida' && t.status !== 'cancelada');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-purple-500" />
          Tarefas & Checklists
          <Badge className="bg-purple-500/10 text-purple-400">
            {tarefasPendentes.length} ativas
          </Badge>
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-purple-500 hover:bg-purple-600">
              <Plus className="w-4 h-4 mr-1" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-800">
            <DialogHeader>
              <DialogTitle className="text-white">Nova Tarefa de Campo</DialogTitle>
            </DialogHeader>
            <FormTarefa obraId={obraId} onSubmit={criarMutation.mutate} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {tarefas.map(tarefa => (
          <Card key={tarefa.id} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={prioridadeConfig[tarefa.prioridade]?.color}>
                      {prioridadeConfig[tarefa.prioridade]?.label}
                    </Badge>
                    <Badge className={statusConfig[tarefa.status]?.color}>
                      {statusConfig[tarefa.status]?.label}
                    </Badge>
                    {tarefa.tipo === 'checklist' && (
                      <Badge variant="outline" className="text-xs">
                        <CheckSquare className="w-3 h-3 mr-1" />
                        Checklist
                      </Badge>
                    )}
                  </div>
                  <h4 className="text-white font-medium mb-1">{tarefa.titulo}</h4>
                  {tarefa.descricao && (
                    <p className="text-gray-400 text-sm mb-2">{tarefa.descricao}</p>
                  )}
                  {tarefa.responsavel && (
                    <p className="text-gray-500 text-xs">{tarefa.responsavel}</p>
                  )}
                </div>
              </div>

              {/* Checklist Items */}
              {tarefa.itens_checklist && tarefa.itens_checklist.length > 0 && (
                <div className="space-y-2 mb-3">
                  {tarefa.itens_checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-900 rounded">
                      <Checkbox
                        checked={item.concluido}
                        onCheckedChange={() => toggleItemChecklist(tarefa, idx)}
                      />
                      <span className={cn(
                        "text-sm flex-1",
                        item.concluido ? "text-gray-500 line-through" : "text-gray-300"
                      )}>
                        {item.texto}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Mídia */}
              <div className="flex gap-2 mb-3">
                {tarefa.fotos && tarefa.fotos.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    {tarefa.fotos.length} foto(s)
                  </Badge>
                )}
                {tarefa.videos && tarefa.videos.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Video className="w-3 h-3 mr-1" />
                    {tarefa.videos.length} vídeo(s)
                  </Badge>
                )}
                {tarefa.latitude && tarefa.longitude && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="w-3 h-3 mr-1" />
                    GPS
                  </Badge>
                )}
              </div>

              {/* Ações */}
              {tarefa.status !== 'concluida' && (
                <div className="flex gap-2">
                  {tarefa.status === 'pendente' && (
                    <Button
                      size="sm"
                      onClick={() => mudarStatus(tarefa, 'em_andamento')}
                      className="bg-blue-500 hover:bg-blue-600 text-xs"
                    >
                      Iniciar
                    </Button>
                  )}
                  {tarefa.status === 'em_andamento' && (
                    <Button
                      size="sm"
                      onClick={() => mudarStatus(tarefa, 'concluida')}
                      className="bg-emerald-500 hover:bg-emerald-600 text-xs"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Concluir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mudarStatus(tarefa, 'cancelada')}
                    className="border-gray-700 text-gray-400 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FormTarefa({ obraId, onSubmit }) {
  const [formData, setFormData] = useState({
    obra_id: obraId,
    titulo: '',
    descricao: '',
    tipo: 'tarefa',
    prioridade: 'normal',
    status: 'pendente',
    responsavel: '',
    itens_checklist: []
  });

  const adicionarItemChecklist = () => {
    setFormData({
      ...formData,
      itens_checklist: [
        ...(formData.itens_checklist || []),
        { texto: '', concluido: false }
      ]
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Título da tarefa"
        value={formData.titulo}
        onChange={(e) => setFormData({...formData, titulo: e.target.value})}
        className="bg-gray-800 border-gray-700 text-white"
        required
      />

      <Textarea
        placeholder="Descrição"
        value={formData.descricao}
        onChange={(e) => setFormData({...formData, descricao: e.target.value})}
        className="bg-gray-800 border-gray-700 text-white"
      />

      <div className="grid grid-cols-2 gap-3">
        <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="tarefa">Tarefa</SelectItem>
            <SelectItem value="checklist">Checklist</SelectItem>
          </SelectContent>
        </Select>

        <Select value={formData.prioridade} onValueChange={(v) => setFormData({...formData, prioridade: v})}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
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

      <Input
        placeholder="Responsável"
        value={formData.responsavel}
        onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
        className="bg-gray-800 border-gray-700 text-white"
      />

      {formData.tipo === 'checklist' && (
        <div>
          <Button type="button" onClick={adicionarItemChecklist} size="sm" variant="outline" className="mb-2">
            <Plus className="w-3 h-3 mr-1" />
            Adicionar Item
          </Button>
          <div className="space-y-2">
            {(formData.itens_checklist || []).map((item, idx) => (
              <Input
                key={idx}
                placeholder={`Item ${idx + 1}`}
                value={item.texto}
                onChange={(e) => {
                  const novosItens = [...formData.itens_checklist];
                  novosItens[idx].texto = e.target.value;
                  setFormData({...formData, itens_checklist: novosItens});
                }}
                className="bg-gray-800 border-gray-700 text-white text-sm"
              />
            ))}
          </div>
        </div>
      )}

      <Button type="submit" className="w-full bg-purple-500 hover:bg-purple-600">
        Criar Tarefa
      </Button>
    </form>
  );
}