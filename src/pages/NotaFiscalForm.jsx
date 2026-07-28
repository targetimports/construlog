import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function NotaFiscalForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    categoria: 'material',
    status: 'registrada'
  });
  const queryClient = useQueryClient();

  const { data: nfs } = useQuery({
    queryKey: ['notas-fiscais'],
    queryFn: () => base44.entities.NotaFiscal.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.NotaFiscal.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-fiscais'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] });
      setDados({
        data: new Date().toISOString().split('T')[0],
        categoria: 'material',
        status: 'registrada'
      });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">NOTAS FISCAIS</h1>
          <p className="text-gray-600">Registre notas fiscais recebidas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova NF
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Nota Fiscal</CardTitle>
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
                <label className="block text-sm font-medium mb-1">Número NF *</label>
                <input
                  type="text"
                  value={dados.numero_nf || ''}
                  onChange={(e) => setDados({ ...dados, numero_nf: e.target.value })}
                  placeholder="Ex: 123456"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
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

            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <input
                type="text"
                value={dados.descricao || ''}
                onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select
                  value={dados.categoria}
                  onChange={(e) => setDados({ ...dados, categoria: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="material">Material</option>
                  <option value="aluguel">Aluguel</option>
                  <option value="frete">Frete</option>
                  <option value="alimentacao">Alimentação</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor Bruto *</label>
                <input
                  type="number"
                  value={dados.valor_bruto || ''}
                  onChange={(e) => setDados({ ...dados, valor_bruto: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor Líquido</label>
                <input
                  type="number"
                  value={dados.valor_liquido || ''}
                  onChange={(e) => setDados({ ...dados, valor_liquido: parseFloat(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                disabled={createMutation.isPending || !dados.numero_nf || !dados.valor_bruto}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {createMutation.isPending ? 'Salvando...' : 'Registrar NF'}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de NFs */}
      <Card>
        <CardHeader>
          <CardTitle>Notas Fiscais Registradas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {nfs && nfs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">NF</th>
                  <th className="text-left py-2 px-3">Fornecedor</th>
                  <th className="text-left py-2 px-3">Categoria</th>
                  <th className="text-right py-2 px-3">Valor</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {nfs.map(nf => (
                  <tr key={nf.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(nf.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 font-mono font-bold">{nf.numero_nf}</td>
                    <td className="py-2 px-3 text-xs">{nf.fornecedor_id?.substring(0, 20) || '-'}</td>
                    <td className="py-2 px-3 text-xs capitalize">{nf.categoria}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(nf.valor_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-xs capitalize">{nf.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhuma nota fiscal registrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}