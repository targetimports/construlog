import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function VeiculoForm({ veiculo, onClose }) {
  const [form, setForm] = useState(veiculo || {
    placa: '',
    tipo: 'carro',
    modelo: '',
    capacidade: '',
    combustivel: 'gasolina',
    status: 'ativo'
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (veiculo?.id) {
        return base44.entities.Veiculo.update(veiculo.id, data);
      } else {
        return base44.entities.Veiculo.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      toast.success(veiculo ? 'Veículo atualizado!' : 'Veículo criado!');
      onClose?.();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{veiculo ? 'Editar Veículo' : 'Novo Veículo'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Placa *</label>
              <Input
                required
                value={form.placa}
                onChange={(e) => setForm({...form, placa: e.target.value})}
                placeholder="ABC-1234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Modelo *</label>
              <Input
                required
                value={form.modelo}
                onChange={(e) => setForm({...form, modelo: e.target.value})}
                placeholder="Toyota Hilux"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({...form, tipo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="carro">Carro</option>
                <option value="moto">Moto</option>
                <option value="caminhonete">Caminhonete</option>
                <option value="caminhao">Caminhão</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Combustível</label>
              <select
                value={form.combustivel}
                onChange={(e) => setForm({...form, combustivel: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="gasolina">Gasolina</option>
                <option value="diesel">Diesel</option>
                <option value="flex">Flex</option>
                <option value="eletrico">Elétrico</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Capacidade</label>
              <Input
                value={form.capacidade}
                onChange={(e) => setForm({...form, capacidade: e.target.value})}
                placeholder="2500 kg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({...form, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ativo">Ativo</option>
                <option value="manutencao">Manutenção</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}