import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DashboardLogistica() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: viagens = [] } = useQuery({
    queryKey: ['viagens-hoje'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      return base44.entities.Viagem.filter({ data: hoje });
    }
  });

  const viagensEmAndamento = viagens.filter(v => v.status === 'em_andamento');
  const viagensPendentes = viagens.filter(v => v.status === 'planejada');

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Logística</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Viagens Hoje</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{viagens.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{viagensEmAndamento.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{viagensPendentes.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl('MinhasViagens')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Minhas Rotas</span>
              </div>
            </Link>
            <Link to={createPageUrl('ViagensAbastecimentos')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Viagens & Abastecimentos</span>
              </div>
            </Link>
            <Link to={createPageUrl('Frota')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Frota</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}