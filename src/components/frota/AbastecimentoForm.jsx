import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AbastecimentoForm({ abastecimento, onClose }) {
  const [form, setForm] = useState(abastecimento || {
    viagem_id: '',
    data: new Date().toISOString(),
    litros: 0,
    valor_total: 0,
    posto: '',
    comprovante_url: ''
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      return abastecimento?.id
        ? base44.entities.Abastecimento.update(abastecimento.id, data)
        : base44.entities.Abastecimento.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['abastecimentos'] });
      toast.success(abastecimento ? 'Abastecimento atualizado!' : 'Abastecimento registrado!');
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
        <CardTitle>{abastecimento ? 'Editar Abastecimento' : 'Registrar Abastecimento'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data *</label>
              <Input
                type="datetime-local"
                required
                value={form.data.slice(0, 16)}
                onChange={(e) => setForm({...form, data: new Date(e.target.value).toISOString()})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Posto</label>
              <Input value={form.posto} onChange={(e) => setForm({...form, posto: e.target.value})} placeholder="Nome do posto" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Litros *</label>
              <Input type="number" step="0.01" required value={form.litros} onChange={(e) => setForm({...form, litros: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Total *</label>
              <Input type="number" step="0.01" required value={form.valor_total} onChange={(e) => setForm({...form, valor_total: parseFloat(e.target.value)})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Comprovante URL</label>
            <Input value={form.comprovante_url} onChange={(e) => setForm({...form, comprovante_url: e.target.value})} placeholder="https://..." />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={mutation.isPending}>Salvar</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}