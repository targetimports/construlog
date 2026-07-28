import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, Package, DollarSign } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import RelatorioCustosObra from '../components/relatorios-avancados/RelatorioCustosObra';
import RelatorioCustosMaterial from '../components/relatorios-avancados/RelatorioCustosMaterial';
import DashboardCompras from '../components/relatorios-avancados/DashboardCompras';

export default function RelatoriosAvancados({ embedded = false }) {
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => base44.entities.RequisicaoCompra.list()
  });

  const { data: ordens = [] } = useQuery({
    queryKey: ['ordens-compra'],
    queryFn: () => base44.entities.OrdemCompra.list()
  });

  // Estatísticas gerais
  const totalObras = obras.length;
  const totalMateriais = materiais.length;
  const totalRequisicoes = requisicoes.length;
  const totalOrdens = ordens.length;

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Relatórios Avançados"
          subtitle="Análises detalhadas de custos, compras e desempenho"
          icon={FileText}
        />
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total de Obras', valor: totalObras, icon: TrendingUp, cor: 'text-gray-400' },
          { label: 'Materiais', valor: totalMateriais, icon: Package, cor: 'text-gray-400' },
          { label: 'Requisições', valor: totalRequisicoes, icon: FileText, cor: 'text-gray-400' },
          { label: 'Ordens de Compra', valor: totalOrdens, icon: DollarSign, cor: 'text-gray-400' },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i} className="bg-white border-gray-200 shadow-none">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">{k.label}</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{k.valor}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${k.cor} opacity-30`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs de Relatórios */}
      <Tabs defaultValue="custos-obra" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3 lg:w-auto">
          <TabsTrigger value="custos-obra">Custos por Obra</TabsTrigger>
          <TabsTrigger value="custos-material">Custos por Material</TabsTrigger>
          <TabsTrigger value="dashboard-compras">Dashboard Compras</TabsTrigger>
        </TabsList>

        <TabsContent value="custos-obra" className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Análise de Custos por Obra</CardTitle>
            </CardHeader>
            <CardContent>
              <RelatorioCustosObra obras={obras} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custos-material" className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Análise de Custos por Material</CardTitle>
            </CardHeader>
            <CardContent>
              <RelatorioCustosMaterial materiais={materiais} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard-compras" className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Dashboard de Desempenho de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <DashboardCompras
                requisicoes={requisicoes}
                ordens={ordens}
                obras={obras}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}