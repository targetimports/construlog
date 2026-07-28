import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function AluguelForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'aluguel_maquina'
  });
  const queryClient = useQueryClient();

  const { data: aluguel } = useQuery({
    queryKey: ['aluguel'],
    queryFn: () => base44.entities.AluguelEquipamento.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.AluguelEquipamento.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aluguel'] });
      setDados({ data: new Date().toISOString().split('T')[0], tipo: 'aluguel_maquina' });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">ALUGUEL MAQ E COMBUSTÍVEL</h1>
          <p className="text-gray-600">Aluguel de máquinas, veículos, equipamentos e combustível</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Lançamento</CardTitle>
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
                <label className="block text-sm font-medium mb-1">Tipo *</label>
                <select
                  value={dados.tipo}
                  onChange={(e) => setDados({ ...dados, tipo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="aluguel_maquina">Aluguel Máquina</option>
                  <option value="aluguel_equipamento">Aluguel Equipamento</option>
                  <option value="aluguel_veiculo">Aluguel Veículo</option>
                  <option value="combustivel">Combustível</option>
                  <option value="manutencao">Manutenção</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição *</label>
              <input
                type="text"
                value={dados.descricao || ''}
                onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={dados.fornecedor_id || ''}
                  onChange={(e) => setDados({ ...dados, fornecedor_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade</label>
                <input
                  type="number"
                  value={dados.quantidade || ''}
                  onChange={(e) => setDados({ ...dados, quantidade: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unidade</label>
                <select
                  value={dados.unidade || 'dia'}
                  onChange={(e) => setDados({ ...dados, unidade: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="dia">Dia</option>
                  <option value="mes">Mês</option>
                  <option value="hora">Hora</option>
                  <option value="litro">Litro</option>
                  <option value="unidade">Unidade</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor *</label>
                <input
                  type="number"
                  value={dados.valor || ''}
                  onChange={(e) => setDados({ ...dados, valor: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
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
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !dados.descricao || !dados.valor}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {createMutation.isPending ? 'Salvando...' : 'Registrar'}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Aluguel/Combustível</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {aluguel && aluguel.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-right py-2 px-3">Valor</th>
                  <th className="text-left py-2 px-3">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {aluguel.map(a => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 text-xs capitalize">{a.tipo?.replace(/_/g, ' ')}</td>
                    <td className="py-2 px-3">{a.descricao?.substring(0, 30)}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(a.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-xs capitalize">{a.forma_pagamento || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum lançamento registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}