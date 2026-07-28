import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, FileText, TrendingUp, Bell, Shield } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import DashboardFinanceiro from '../components/financeiro-otimizado/DashboardFinanceiro';
import ContasPagarReceber from '../components/financeiro-otimizado/ContasPagarReceber';
import IntegracaoCompras from '../components/financeiro-otimizado/IntegracaoCompras';
import NotificacoesFinanceiras from '../components/financeiro/NotificacoesFinanceiras';
import DashboardInterativo from '../components/financeiro/DashboardInterativo';
import PermissoesGranulares from '../components/auth/PermissoesGranulares';

export default function FinanceiroOtimizado() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => base44.entities.RequisicaoCompra.list()
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens-compra'],
    queryFn: () => base44.entities.OrdemCompra.list()
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro Otimizado"
        subtitle="Gestão completa e integrada das finanças"
        icon={TrendingUp}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 lg:w-auto">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="dashboard-interativo" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Análise Avançada
          </TabsTrigger>
          <TabsTrigger value="contas" className="gap-2">
            <FileText className="w-4 h-4" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="integracao" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Integração
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-2">
            <Shield className="w-4 h-4" />
            Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardFinanceiro contas={contas} obras={obras} />
        </TabsContent>

        <TabsContent value="contas" className="space-y-4">
          <ContasPagarReceber contas={contas} obras={obras} />
        </TabsContent>

        <TabsContent value="integracao" className="space-y-4">
          <IntegracaoCompras 
            contas={contas} 
            obras={obras}
            requisicoes={requisicoes}
            ordens={ordens}
          />
        </TabsContent>

        <TabsContent value="dashboard-interativo" className="space-y-4">
          <DashboardInterativo contas={contas} obras={obras} />
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-4">
          <NotificacoesFinanceiras />
        </TabsContent>

        <TabsContent value="permissoes" className="space-y-4">
          <PermissoesGranulares />
        </TabsContent>
      </Tabs>
    </div>
  );
}