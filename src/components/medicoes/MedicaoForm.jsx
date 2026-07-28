import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function MedicaoForm({ medicao, onClose }) {
  const [form, setForm] = useState(medicao || {
    numero: '',
    data_medicao: new Date().toISOString().split('T')[0],
    obra_id: '',
    status: 'rascunho',
    valor_total_realizado: 0,
    observacoes: ''
  });

  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const dataWithUser = {
        ...data,
        responsavel_email: user?.email
      };
      if (medicao?.id) {
        return base44.entities.Medicao.update(medicao.id, dataWithUser);
      } else {
        return base44.entities.Medicao.create(dataWithUser);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicoes'] });
      toast.success(medicao ? 'Medição atualizada!' : 'Medição criada!');
      onClose?.();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.obra_id) {
      toast.error('Selecione uma obra');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{medicao ? 'Editar Medição' : 'Nova Medição'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Número</label>
              <Input
                value={form.numero}
                onChange={(e) => setForm({...form, numero: e.target.value})}
                placeholder="MED-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data *</label>
              <Input
                type="date"
                required
                value={form.data_medicao}
                onChange={(e) => setForm({...form, data_medicao: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Obra *</label>
            <select
              required
              value={form.obra_id}
              onChange={(e) => setForm({...form, obra_id: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Selecione uma obra</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor Total Realizado</label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_total_realizado}
                onChange={(e) => setForm({...form, valor_total_realizado: parseFloat(e.target.value)})}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({...form, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="rascunho">Rascunho</option>
                <option value="confirmada">Confirmada</option>
                <option value="processada">Processada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({...form, observacoes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="3"
            />
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