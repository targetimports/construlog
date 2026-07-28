import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function EquipamentosUtilizados({ obraId }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    equipamento_id: '',
    data_inicio: '',
    data_fim: '',
    tipo_uso: 'proprio',
    observacoes: ''
  });
  const queryClient = useQueryClient();

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const { data: usos = [] } = useQuery({
    queryKey: ['usos-equipamento', obraId],
    queryFn: () => base44.entities.RegistroUsoEquipamento.filter({ obra_id: obraId })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('registrarUsoEquipamento', { ...data, obra_id: obraId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usos-equipamento', obraId] });
      queryClient.invalidateQueries({ queryKey: ['obra-resumo', obraId] });
      setShowForm(false);
      setFormData({ equipamento_id: '', data_inicio: '', data_fim: '', tipo_uso: 'proprio', observacoes: '' });
      toast.success('Uso de equipamento registrado e integrado ao financeiro');
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('removerUsoEquipamento', { registro_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usos-equipamento', obraId] });
      queryClient.invalidateQueries({ queryKey: ['obra-resumo', obraId] });
      toast.success('Registro removido');
    }
  });

  const handleSubmit = () => {
    if (!formData.equipamento_id || !formData.data_inicio) {
      toast.error('Equipamento e data de início são obrigatórios');
      return;
    }
    createMutation.mutate(formData);
  };

  const totalCusto = usos.reduce((sum, uso) => sum + (uso.custo_total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Equipamentos Utilizados</h3>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Registrar Uso
        </Button>
      </div>

      {usos.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-700">
              <strong>Custo Total de Equipamentos:</strong> R$ {totalCusto.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {usos.map(uso => {
          const equip = equipamentos.find(e => e.id === uso.equipamento_id);
          return (
            <Card key={uso.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{equip?.nome}</p>
                    <div className="flex gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {uso.horas_trabalhadas}h</span>
                      <span>{new Date(uso.data_inicio).toLocaleDateString()}</span>
                      <span className="bg-gray-200 px-2 py-1 rounded text-xs">{uso.tipo_uso}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ {uso.custo_total?.toFixed(2)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(uso.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Uso de Equipamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={formData.equipamento_id} onValueChange={(val) => setFormData({ ...formData, equipamento_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar equipamento" />
              </SelectTrigger>
              <SelectContent>
                {equipamentos.filter(e => e.status === 'ativo').map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="datetime-local" placeholder="Data/hora de início" value={formData.data_inicio} onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })} />
            <Input type="datetime-local" placeholder="Data/hora de término (opcional)" value={formData.data_fim} onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })} />
            <Select value={formData.tipo_uso} onValueChange={(val) => setFormData({ ...formData, tipo_uso: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proprio">Próprio</SelectItem>
                <SelectItem value="alugado">Alugado</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Observações" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} />
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full">
              Registrar Uso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}