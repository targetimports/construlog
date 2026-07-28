import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function MaoDeObraForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'diaria'
  });
  const queryClient = useQueryClient();

  const { data: maoDeObra } = useQuery({
    queryKey: ['mao-de-obra'],
    queryFn: () => base44.entities.MaoDeObra.list()
  });

  const { data: pessoas } = useQuery({
    queryKey: ['pessoas'],
    queryFn: () => base44.entities.Pessoa.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.MaoDeObra.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mao-de-obra'] });
      setDados({
        data: new Date().toISOString().split('T')[0],
        tipo: 'diaria'
      });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">MÃO DE OBRA</h1>
          <p className="text-gray-600">Registre custos com funcionários, diárias, salários e empreitas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Lançamento de Mão de Obra</CardTitle>
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
                  <option value="diaria">Diária</option>
                  <option value="empreita">Empreita</option>
                  <option value="salario">Salário</option>
                  <option value="avulso">Avulso</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pessoa / Funcionário *</label>
              <input
                type="text"
                value={dados.pessoa_id || ''}
                onChange={(e) => setDados({ ...dados, pessoa_id: e.target.value })}
                placeholder="Nome ou ID"
                list="pessoas-list"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
              <datalist id="pessoas-list">
                {pessoas?.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <input
                type="text"
                value={dados.descricao || ''}
                onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade (dias/unid)</label>
                <input
                  type="number"
                  value={dados.quantidade || ''}
                  onChange={(e) => setDados({ ...dados, quantidade: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
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

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !dados.pessoa_id || !dados.valor}
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
          <CardTitle>Histórico de Mão de Obra</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {maoDeObra && maoDeObra.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Pessoa</th>
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-right py-2 px-3">Qtd</th>
                  <th className="text-right py-2 px-3">Valor</th>
                  <th className="text-left py-2 px-3">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {maoDeObra.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 font-medium">{m.pessoa_id?.substring(0, 20)}</td>
                    <td className="py-2 px-3 text-xs capitalize">{m.tipo}</td>
                    <td className="text-right py-2 px-3">{m.quantidade || '-'}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(m.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-xs capitalize">{m.forma_pagamento || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum lançamento de mão de obra
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}