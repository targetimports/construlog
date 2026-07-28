import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function EstadiasForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'hotel'
  });
  const queryClient = useQueryClient();

  const { data: estadias } = useQuery({
    queryKey: ['estadias'],
    queryFn: () => base44.entities.Estadia.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Estadia.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estadias'] });
      setDados({ data: new Date().toISOString().split('T')[0], tipo: 'hotel' });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">ESTADIAS</h1>
          <p className="text-gray-600">Custos de hospedagem e permanência</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Estadia
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Estadia</CardTitle>
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
                  <option value="hotel">Hotel</option>
                  <option value="pousada">Pousada</option>
                  <option value="aluguel_casa">Aluguel Casa</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição/Local *</label>
              <input
                type="text"
                value={dados.descricao || ''}
                onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data Check-in</label>
                <input
                  type="date"
                  value={dados.data_checkin || ''}
                  onChange={(e) => setDados({ ...dados, data_checkin: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Check-out</label>
                <input
                  type="date"
                  value={dados.data_checkout || ''}
                  onChange={(e) => setDados({ ...dados, data_checkout: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
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
          <CardTitle>Histórico de Estadias</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {estadias && estadias.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-left py-2 px-3">Período</th>
                  <th className="text-right py-2 px-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {estadias.map(e => (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(e.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 capitalize text-xs">{e.tipo}</td>
                    <td className="py-2 px-3">{e.descricao}</td>
                    <td className="py-2 px-3 text-xs">{e.data_checkin ? `${e.data_checkin} a ${e.data_checkout}` : '-'}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(e.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhuma estadia registrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}