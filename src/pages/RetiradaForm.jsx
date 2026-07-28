import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function RetiradaForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    pessoa_id: ''
  });
  const queryClient = useQueryClient();

  const { data: retiradas } = useQuery({
    queryKey: ['retiradas'],
    queryFn: () => base44.entities.Retirada.list()
  });

  const { data: pessoas } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Retirada.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiradas'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] });
      setDados({ data: new Date().toISOString().split('T')[0], pessoa_id: '' });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">RETIRADAS DE SÓCIOS</h1>
          <p className="text-gray-600">Registro de retiradas pessoais dos sócios</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Registrar Retirada
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Retirada</CardTitle>
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
                <label className="block text-sm font-medium mb-1">Sócio *</label>
                <select
                  value={dados.pessoa_id}
                  onChange={(e) => setDados({ ...dados, pessoa_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Selecione um sócio</option>
                  {pessoas?.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
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
                <label className="block text-sm font-medium mb-1">Forma de Pagamento *</label>
                <select
                  value={dados.forma_pagamento || ''}
                  onChange={(e) => setDados({ ...dados, forma_pagamento: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Selecione</option>
                  <option value="pix">PIX</option>
                  <option value="ted">TED</option>
                  <option value="transferencia">Transferência</option>
                  <option value="cheque">Cheque</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Motivo</label>
              <input
                type="text"
                value={dados.motivo || ''}
                onChange={(e) => setDados({ ...dados, motivo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ex: Uso pessoal, pro-labore"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea
                value={dados.observacao || ''}
                onChange={(e) => setDados({ ...dados, observacao: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !dados.valor || !dados.pessoa_id}
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
          <CardTitle>Histórico de Retiradas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {retiradas && retiradas.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Sócio</th>
                  <th className="text-left py-2 px-3">Motivo</th>
                  <th className="text-left py-2 px-3">Forma Pagamento</th>
                  <th className="text-right py-2 px-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {retiradas.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 font-medium">{r.pessoa_id}</td>
                    <td className="py-2 px-3 text-xs">{r.motivo || '-'}</td>
                    <td className="py-2 px-3 capitalize">{r.forma_pagamento || '-'}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(r.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhuma retirada registrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}