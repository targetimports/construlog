import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function EstoqueForm({ material, onClose }) {
  const [form, setForm] = useState(material || {
    descricao_material: '',
    quantidade: 0,
    unidade: 'un',
    valor_unitario: 0,
    valor_total: 0,
    data: new Date().toISOString().split('T')[0],
    fornecedor_id: '',
    forma_pagamento: 'pix',
    observacao: ''
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      const dataWithTotal = {
        ...data,
        valor_total: (data.quantidade || 0) * (data.valor_unitario || 0)
      };
      return material?.id
        ? base44.entities.Material.update(material.id, dataWithTotal)
        : base44.entities.Material.create(dataWithTotal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiais'] });
      toast.success(material ? 'Material atualizado!' : 'Material cadastrado!');
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
        <CardTitle>{material ? 'Editar Material' : 'Novo Material'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descrição *</label>
            <Input
              required
              value={form.descricao_material}
              onChange={(e) => setForm({...form, descricao_material: e.target.value})}
              placeholder="Cimento, Areia, Tijolos..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade *</label>
              <Input
                type="number"
                step="0.01"
                required
                value={form.quantidade}
                onChange={(e) => setForm({...form, quantidade: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select
                value={form.unidade}
                onChange={(e) => setForm({...form, unidade: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="un">Unidade</option>
                <option value="kg">Kg</option>
                <option value="m">Metro</option>
                <option value="m2">m²</option>
                <option value="m3">m³</option>
                <option value="l">Litro</option>
                <option value="sc">Saco</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Unitário *</label>
              <Input
                type="number"
                step="0.01"
                required
                value={form.valor_unitario}
                onChange={(e) => setForm({...form, valor_unitario: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <Input
                type="date"
                value={form.data}
                onChange={(e) => setForm({...form, data: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
              <select
                value={form.forma_pagamento}
                onChange={(e) => setForm({...form, forma_pagamento: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="pix">PIX</option>
                <option value="ted">TED</option>
                <option value="transferencia">Transferência</option>
                <option value="cheque">Cheque</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observação</label>
            <textarea
              value={form.observacao}
              onChange={(e) => setForm({...form, observacao: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="2"
            />
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