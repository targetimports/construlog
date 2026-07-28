import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, FileText, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DashboardEngenharia() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' })
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes-pendentes'],
    queryFn: () => base44.entities.MedicaoObra.filter({ status: 'rascunho' })
  });

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Engenharia</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Obras Ativas</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{obras.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Medições Pendentes</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{medicoes.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl('Obras')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Gerenciar Obras</span>
              </div>
            </Link>
            <Link to={createPageUrl('Medicoes')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <span className="font-medium">Medições</span>
              </div>
            </Link>
            <Link to={createPageUrl('DiarioObra')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Diário de Obra</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}