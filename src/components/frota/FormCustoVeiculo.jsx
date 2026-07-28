import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function FormCustoVeiculo({ open, onOpenChange, veiculo }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    veiculo_id: veiculo?.id || '',
    tipo: 'combustivel',
    descricao: '',
    valor: '',
    data_custo: new Date().toISOString().split('T')[0],
    km_odometro: '',
    observacoes: ''
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.CustoVeiculo.create({
        ...data,
        veiculo_id: formData.veiculo_id,
        valor: parseFloat(data.valor),
        km_odometro: data.km_odometro ? parseInt(data.km_odometro) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['custos-veiculo']);
      toast.success('Custo registrado!');
      setFormData({
        veiculo_id: veiculo?.id || '',
        tipo: 'combustivel',
        descricao: '',
        valor: '',
        data_custo: new Date().toISOString().split('T')[0],
        km_odometro: '',
        observacoes: ''
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.valor) {
      toast.error('Informe o valor do custo');
      return;
    }
    salvarMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-white">Registrar Custo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-400">Tipo de Custo *</Label>
            <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="combustivel">Combustível</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="pedagio">Pedágio</SelectItem>
                <SelectItem value="estacionamento">Estacionamento</SelectItem>
                <SelectItem value="multa">Multa</SelectItem>
                <SelectItem value="seguro">Seguro</SelectItem>
                <SelectItem value="ipva">IPVA</SelectItem>
                <SelectItem value="licenciamento">Licenciamento</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-400">Descrição</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="Ex: Abastecimento em SP"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({...formData, valor: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-gray-400">Data</Label>
              <Input
                type="date"
                value={formData.data_custo}
                onChange={(e) => setFormData({...formData, data_custo: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">KM Odômetro</Label>
            <Input
              type="number"
              value={formData.km_odometro}
              onChange={(e) => setFormData({...formData, km_odometro: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1"
            />
          </div>

          <div>
            <Label className="text-gray-400">Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1 min-h-16"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending} className="flex-1 bg-amber-500 hover:bg-amber-600">
              {salvarMutation.isPending ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}