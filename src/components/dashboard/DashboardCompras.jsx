import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DashboardCompras() {
  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-compras'],
    queryFn: () => base44.entities.RequisicaoCompra?.list?.('-updated_date', 15).catch(() => []),
    staleTime: 300000,
    gcTime: 600000
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['ordens-compras'],
    queryFn: () => base44.entities.OrdemCompra?.list?.('-updated_date', 10).catch(() => []),
    staleTime: 300000,
    gcTime: 600000
  });

  const reqPendentes = requisicoes.filter(r => r.status === 'aguardando_aprovacao' || r.status === 'em_cotacao').length;
  const ocPendentes = ordensCompra.filter(o => o.status !== 'recebida' && o.status !== 'cancelada').length;
  const ocTotal = ordensCompra.length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Compras</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Requisições Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{reqPendentes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Ordens em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{ocPendentes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total OCs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{ocTotal}</p>
            <p className="text-xs text-gray-500 mt-1">{ocPendentes} em aberto</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Requisições em Andamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {requisicoes.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                <p className="text-sm font-medium">{r.titulo || 'Requisição'}</p>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  r.status === 'comprada' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>{r.status}</span>
              </div>
            ))}
            {requisicoes.length === 0 && (
              <p className="text-center text-gray-500 py-6 text-sm">Nenhuma requisição</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}