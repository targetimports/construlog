import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

const LIMIT = 10;

export default function DashboardCampo() {
  const [page, setPage] = useState(0);

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas-campo', page],
    queryFn: () => base44.entities.TarefaCampo?.list?.('-updated_date', LIMIT).catch(() => []),
    staleTime: 300000, // 5min cache
    gcTime: 600000      // 10min cache
  });

  const tarefasPendentes = tarefas.filter(t => t.status === 'pendente').length;
  const tarefasConcluidas = tarefas.filter(t => t.status === 'concluida').length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Campo</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Tarefas Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{tarefasPendentes}</p>
            <p className="text-xs text-gray-500 mt-1">{tarefasConcluidas} concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Taxa Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {tarefas.length > 0 ? Math.round((tarefasConcluidas / tarefas.length) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-green-600">✓ Operacional</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Tarefas do Dia
          </CardTitle>
          <span className="text-xs text-gray-500">{tarefas.length} tarefas</span>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tarefas.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                <p className="text-sm font-medium">{t.descricao || 'Tarefa'}</p>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  t.status === 'concluida' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>{t.status}</span>
              </div>
            ))}
            {tarefas.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">Nenhuma tarefa</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}