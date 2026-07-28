import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ContratoForm({ contrato, onClose }) {
  const [form, setForm] = useState(contrato || {
    numero: '',
    tipo: 'fornecedor',
    descricao: '',
    valor_total: 0,
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    fornecedor_cliente: '',
    status: 'ativo',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      return contrato?.id
        ? base44.entities.Contrato?.update(contrato.id, data)
        : base44.entities.Contrato?.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success(contrato ? 'Contrato atualizado!' : 'Contrato criado!');
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
        <CardTitle>{contrato ? 'Editar Contrato' : 'Novo Contrato'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Número *</label>
              <Input required value={form.numero} onChange={(e) => setForm({...form, numero: e.target.value})} placeholder="CT-2024-001" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({...form, tipo: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="fornecedor">Fornecedor</option>
                <option value="cliente">Cliente</option>
                <option value="colaborador">Colaborador</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fornecedor/Cliente *</label>
            <Input required value={form.fornecedor_cliente} onChange={(e) => setForm({...form, fornecedor_cliente: e.target.value})} placeholder="Nome da empresa" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data Início</label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({...form, data_inicio: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Fim</label>
              <Input type="date" value={form.data_fim} onChange={(e) => setForm({...form, data_fim: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor Total</label>
              <Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({...form, valor_total: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="3" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows="2" />
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