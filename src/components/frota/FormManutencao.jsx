import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function FormManutencao({ open, onOpenChange, veiculo, manutencao }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    veiculo_id: veiculo?.id || '',
    tipo: 'preventiva',
    descricao: '',
    categoria: 'oleo_filtro',
    status: 'agendada',
    data_agendamento: '',
    km_agendado: '',
    km_proximo: '',
    data_proximo_agendamento: '',
    oficina: '',
    custo_estimado: '',
    notas: ''
  });

  useEffect(() => {
    if (manutencao) {
      setFormData({
        veiculo_id: manutencao.veiculo_id,
        tipo: manutencao.tipo || 'preventiva',
        descricao: manutencao.descricao || '',
        categoria: manutencao.categoria || 'oleo_filtro',
        status: manutencao.status || 'agendada',
        data_agendamento: manutencao.data_agendamento || '',
        km_agendado: manutencao.km_agendado || '',
        km_proximo: manutencao.km_proximo || '',
        data_proximo_agendamento: manutencao.data_proximo_agendamento || '',
        oficina: manutencao.oficina || '',
        custo_estimado: manutencao.custo_estimado || '',
        notas: manutencao.notas || ''
      });
    }
  }, [manutencao, open]);

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const dataToSave = {
        ...data,
        veiculo_id: formData.veiculo_id,
        km_agendado: data.km_agendado ? parseFloat(data.km_agendado) : null,
        km_proximo: data.km_proximo ? parseFloat(data.km_proximo) : null,
        custo_estimado: data.custo_estimado ? parseFloat(data.custo_estimado) : null
      };

      if (manutencao) {
        return base44.entities.ManutencaoVeiculo.update(manutencao.id, dataToSave);
      }
      return base44.entities.ManutencaoVeiculo.create(dataToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['manutencoes']);
      toast.success(manutencao ? 'Manutenção atualizada!' : 'Manutenção agendada!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    salvarMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {manutencao ? 'Editar Manutenção' : 'Agendar Manutenção'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-400">Categoria *</Label>
              <Select value={formData.categoria} onValueChange={(v) => setFormData({...formData, categoria: v})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="oleo_filtro">Óleo e Filtro</SelectItem>
                  <SelectItem value="pneus">Pneus</SelectItem>
                  <SelectItem value="freios">Freios</SelectItem>
                  <SelectItem value="suspensao">Suspensão</SelectItem>
                  <SelectItem value="bateria">Bateria</SelectItem>
                  <SelectItem value="eletrica">Elétrica</SelectItem>
                  <SelectItem value="motor">Motor</SelectItem>
                  <SelectItem value="transmissao">Transmissão</SelectItem>
                  <SelectItem value="revisao_completa">Revisão Completa</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Descrição *</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1 min-h-20"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Data Agendamento</Label>
              <Input
                type="date"
                value={formData.data_agendamento}
                onChange={(e) => setFormData({...formData, data_agendamento: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Próxima Manutenção (data)</Label>
              <Input
                type="date"
                value={formData.data_proximo_agendamento}
                onChange={(e) => setFormData({...formData, data_proximo_agendamento: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">KM Agendado</Label>
              <Input
                type="number"
                value={formData.km_agendado}
                onChange={(e) => setFormData({...formData, km_agendado: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">KM Próxima</Label>
              <Input
                type="number"
                value={formData.km_proximo}
                onChange={(e) => setFormData({...formData, km_proximo: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Oficina</Label>
              <Input
                value={formData.oficina}
                onChange={(e) => setFormData({...formData, oficina: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Custo Estimado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.custo_estimado}
                onChange={(e) => setFormData({...formData, custo_estimado: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Notas</Label>
            <Textarea
              value={formData.notas}
              onChange={(e) => setFormData({...formData, notas: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1 min-h-16"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-gray-700">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending} className="flex-1 bg-amber-500 hover:bg-amber-600">
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}