import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ImpostosForm() {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    tipo: 'irpj'
  });
  const queryClient = useQueryClient();

  const { data: impostos } = useQuery({
    queryKey: ['impostos'],
    queryFn: () => base44.entities.Imposto.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Imposto.create(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impostos'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro'] });
      setDados({ data_pagamento: new Date().toISOString().split('T')[0], tipo: 'irpj' });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">IMPOSTOS</h1>
          <p className="text-gray-600">Registro manual de impostos e taxas pagos</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Imposto
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Imposto/Taxa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data de Pagamento *</label>
                <input
                  type="date"
                  value={dados.data_pagamento}
                  onChange={(e) => setDados({ ...dados, data_pagamento: e.target.value })}
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
                  <option value="irpj">IRPJ</option>
                  <option value="pis">PIS</option>
                  <option value="cofins">COFINS</option>
                  <option value="icms">ICMS</option>
                  <option value="ipi">IPI</option>
                  <option value="irf">IRF</option>
                  <option value="contribuicao_sindical">Contribuição Sindical</option>
                  <option value="taxa_bancaria">Taxa Bancária</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
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
                <label className="block text-sm font-medium mb-1">Período Competência</label>
                <input
                  type="month"
                  value={dados.periodo_competencia || ''}
                  onChange={(e) => setDados({ ...dados, periodo_competencia: e.target.value })}
                  placeholder="YYYY-MM"
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

            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !dados.valor}
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
          <CardTitle>Histórico de Impostos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {impostos && impostos.length > 0 ? (
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
                {impostos.map(i => (
                  <tr key={i.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(i.data_pagamento).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 font-medium capitalize">{i.tipo}</td>
                    <td className="py-2 px-3 text-xs">{i.descricao || '-'}</td>
                    <td className="py-2 px-3 text-xs">{i.periodo_competencia || '-'}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(i.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum imposto registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}