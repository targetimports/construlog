import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CustoComNF from '@/components/obra/CustoComNF';

export default function AlimentacaoForm({ obraId }) {
  const [showForm, setShowForm] = useState(false);
  const [dados, setDados] = useState({
    data: new Date().toISOString().split('T')[0],
    categoria: 'refeicao'
  });
  const queryClient = useQueryClient();

  const { data: alimentacao } = useQuery({
    queryKey: ['alimentacao'],
    queryFn: () => base44.entities.Alimentacao.list()
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Alimentacao.create({ ...dados, obra_id: obraId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alimentacao'] });
      setDados({ data: new Date().toISOString().split('T')[0], categoria: 'refeicao' });
      setShowForm(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">ALIMENTAÇÃO</h1>
          <p className="text-gray-600">Gastos com alimentação, internet e despesas de funcionários</p>
        </div>
        <CustoComNF
          obraId={obraId}
          tipoEntidade="Alimentacao"
          tituloPrincipal="Novo Gasto - Alimentação"
          descricaoForm="Registrar um novo gasto com alimentação e despesas"
          camposAdicionais={{
            categoria: {
              label: 'Categoria',
              type: 'select',
              options: [
                { value: 'refeicao', label: 'Refeição' },
                { value: 'cafe', label: 'Café/Lanches' },
                { value: 'mercado', label: 'Mercado' },
                { value: 'internet', label: 'Internet' },
                { value: 'telefone', label: 'Telefone' },
                { value: 'outro', label: 'Outro' }
              ]
            }
          }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['alimentacao'] })}
        />
      </div>



      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alimentação</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {alimentacao && alimentacao.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3">Data</th>
                  <th className="text-left py-2 px-3">Fornecedor</th>
                  <th className="text-left py-2 px-3">Categoria</th>
                  <th className="text-right py-2 px-3">Valor</th>
                  <th className="text-left py-2 px-3">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {alimentacao.map(a => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3 text-xs">{a.fornecedor_id?.substring(0, 20) || '-'}</td>
                    <td className="py-2 px-3 capitalize text-xs">{a.categoria}</td>
                    <td className="text-right py-2 px-3 font-bold">R$ {(a.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-xs capitalize">{a.forma_pagamento || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum gasto registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}