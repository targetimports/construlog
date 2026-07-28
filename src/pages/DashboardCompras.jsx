import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, FileText, AlertCircle, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DashboardCompras() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-pendentes'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ status: 'pendente' })
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens-compra'],
    queryFn: () => base44.entities.OrdemCompra.filter({ status: 'aprovada' })
  });

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Compras</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Requisições Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{requisicoes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ordens Aprovadas</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold tabular-nums">{ordens.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl('SuprimentosRequisicoes')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Requisições</span>
              </div>
            </Link>
            <Link to={createPageUrl('SuprimentosPedidos')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-600" />
                <span className="font-medium">Ordens de Compra</span>
              </div>
            </Link>
            <Link to={createPageUrl('Fornecedores')} className="block p-3 hover:bg-gray-50 rounded-lg transition">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Fornecedores</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}