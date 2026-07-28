import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clipboard, Users, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DashboardCampo() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-semana'],
    queryFn: async () => {
      const hoje = new Date();
      const inicioSemana = new Date(hoje.setDate(hoje.getDate() - 7));
      const todos = await base44.entities.DiarioObra.list();
      return todos.filter(d => new Date(d.data) >= inicioSemana);
    }
  });

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Campo</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Diários esta Semana</CardTitle>
            <Clipboard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{diarios.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl('DiarioObra')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Clipboard className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Diário de Obra</span>
              </div>
            </Link>
            <Link to={createPageUrl('ApontamentoHoras')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-green-600" />
                <span className="font-medium">Apontamento de Horas</span>
              </div>
            </Link>
            <Link to={createPageUrl('Equipes')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Equipes</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}