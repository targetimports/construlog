import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, TrendingUp } from 'lucide-react';

export default function DashboardEngenharia() {
  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes-engenharia'],
    queryFn: () => base44.entities.Medicao?.list?.('-updated_date', 10).catch(() => []),
    staleTime: 300000,
    gcTime: 600000
  });

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos-engenharia'],
    queryFn: () => base44.entities.Orcamento?.list?.('-updated_date', 5).catch(() => []),
    staleTime: 600000,
    gcTime: 900000
  });

  const medicoesPendentes = medicoes.filter(m => m.status === 'rascunho' || m.status === 'aguardando_aprovacao').length;
  const medicoesAprovadas = medicoes.filter(m => m.status === 'aprovada').length;
  const taxaAprovacao = medicoes.length > 0 ? Math.round((medicoesAprovadas / medicoes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Engenharia</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Medições Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{medicoesPendentes}</p>
            <p className="text-xs text-gray-500 mt-1">{medicoesAprovadas} aprovadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Orçamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{orcamentos.length}</p>
            <p className="text-xs text-gray-500 mt-1">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Taxa Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{taxaAprovacao}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Medições Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {medicoes.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                <p className="text-sm font-medium">Med. #{m.numero || m.id.substring(0, 8)}</p>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  m.status === 'aprovada' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>{m.status}</span>
              </div>
            ))}
            {medicoes.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">Nenhuma medição</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}