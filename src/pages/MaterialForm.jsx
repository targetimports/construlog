import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function MaterialForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    quantidade: 1,
    unidade: 'un'
  });
  const queryClient = useQueryClient();

  const { data: materiais } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: pessoas } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Material.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiais'] });
      setDados({
        data: new Date().toISOString().split('T')[0],
        quantidade: 1,
        unidade: 'un'
      });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">MATERIAL</h1>
          <p className="text-gray-600">Registre compras de materiais</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Material
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Lançamento de Material</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data *</label>
                <input
                  type="date"
                  value={dados.data}
                  onChange={(e) => setDados({ ...dados, data: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={dados.fornecedor_id || ''}
                  onChange={(e) => setDados({ ...dados, fornecedor_id: e.target.value })}
                  placeholder="Nome ou ID"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Material / Descrição *</label>
              <input
                type="text"
                value={dados.descricao_material || ''}
                onChange={(e) => setDados({ ...dados, descricao_material: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade</label>
                <input
                  type="number"
                  value={dados.quantidade}
                  onChange={(e) => setDados({ ...dados, quantidade: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unidade</label>
                <select
                  value={dados.unidade}
                  onChange={(e) => setDados({ ...dados, unidade: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="un">Unidade</option>
                  <option value="kg">Kg</option>
                  <option value="m">Metro</option>
                  <option value="m2">M²</option>
                  <option value="m3">M³</option>
                  <option value="l">Litro</option>
                  <option value="sc">Saco</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor Total *</label>
                <input
                  type="number"
                  value={dados.valor_total || ''}
                  onChange={(e) => setDados({ ...dados, valor_total: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
              <select
                value={dados.forma_pagamento || 'pix'}
                onChange={(e) => setDados({ ...dados, forma_pagamento: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="pix">PIX</option>
                <option value="ted">TED</option>
                <option value="transferencia">Transferência</option>
                <option value="cheque">Cheque</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observação</label>
              <textarea
                value={dados.observacao || ''}
                onChange={(e) => setDados({ ...dados, observacao: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !dados.descricao_material || !dados.valor_total}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {createMutation.isPending ? 'Salvando...' : 'Registrar Material'}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de materiais */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Materiais</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {materiais && materiais.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Fornecedor</th>
                  <th className="text-left py-2 px-3">Material</th>
                  <th className="text-right py-2 px-3">Qtd</th>
                  <th className="text-right py-2 px-3">Valor</th>
                  <th className="text-left py-2 px-3">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {materiais.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 text-xs">{m.fornecedor_id?.substring(0, 20)}</td>
                    <td className="py-2 px-3 font-medium">{m.descricao_material}</td>
                    <td className="text-right py-2 px-3">{m.quantidade} {m.unidade}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {m.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-xs capitalize">{m.forma_pagamento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum material registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}