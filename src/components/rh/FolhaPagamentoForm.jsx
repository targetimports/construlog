import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function FolhaPagamentoForm({ folha, onClose }) {
  const [form, setForm] = useState(folha || {
    mes_referencia: new Date().getMonth() + 1,
    ano_referencia: new Date().getFullYear(),
    data_pagamento: new Date().toISOString().split('T')[0],
    status: 'aberto',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Simulado - criar entidade de FolhaPagamento quando disponível
      toast.info('Folha de pagamento será processada');
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folhas-pagamento'] });
      toast.success(folha ? 'Folha atualizada!' : 'Folha criada!');
      onClose?.();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const totalFolha = colaboradores.filter(c => c.status === 'ativo').reduce((sum, c) => sum + (c.salario || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{folha ? 'Editar Folha' : 'Nova Folha de Pagamento'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mês *</label>
              <select required value={form.mes_referencia} onChange={(e) => setForm({...form, mes_referencia: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ano *</label>
              <Input type="number" required value={form.ano_referencia} onChange={(e) => setForm({...form, ano_referencia: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Pagamento</label>
              <Input type="date" value={form.data_pagamento} onChange={(e) => setForm({...form, data_pagamento: e.target.value})} />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Folha (Colaboradores Ativos)</p>
            <p className="text-2xl font-bold text-blue-600">R$ {totalFolha.toLocaleString('pt-BR')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" />
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