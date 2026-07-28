import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Wallet,
  TrendingUp,
  PieChart,
  Scale
} from 'lucide-react';

// Dashboard
import DashboardFinanceiroRealTime from '../components/financeiro/DashboardFinanceiroRealTime';

// Caixa & Bancos - lazy load da página Tesouraria que já tem toda a lógica
const TesourariaPage = React.lazy(() => import('./Tesouraria'));


// Fluxo de Caixa
const FluxoCaixaProjetadoPage = React.lazy(() => import('./FluxoCaixaProjetado'));

// Resultado
const DreObraPage = React.lazy(() => import('./DreObra'));
const RelatoriosAvancadosPage = React.lazy(() => import('./RelatoriosAvancados'));
const FinanceiroEstrategicoPage = React.lazy(() => import('./FinanceiroEstrategico'));

// Conciliação
const ConciliacaoPage = React.lazy(() => import('./Conciliacao'));

import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { PageSkeleton } from '@/components/shared/Skeletons';

function FinanceiroContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [subTab, setSubTab] = useState('');
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    const subTabFromUrl = params.get('subtab');
    if (tabFromUrl) setActiveTab(tabFromUrl);
    if (subTabFromUrl) setSubTab(subTabFromUrl);
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'caixa', label: 'Caixa e Bancos', icon: Wallet },
    { id: 'fluxo', label: 'Fluxo de Caixa', icon: TrendingUp },
    { id: 'resultado', label: 'Resultado', icon: PieChart },
    { id: 'conciliacao', label: 'Conciliação', icon: Scale }
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-gray-500 text-sm mt-1">Gestão financeira integrada</p>
      </div>

      <div>
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSubTab(''); }} className="w-full">
          <TabsList className="flex w-full overflow-x-auto justify-start bg-gray-100/80 h-auto gap-1 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-1.5 text-xs shrink-0 whitespace-nowrap"
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="mt-4 animate-in fade-in-50 duration-300">
            <DashboardFinanceiroRealTime />
          </TabsContent>

          {/* Caixa & Bancos */}
          <TabsContent value="caixa" className="mt-4 animate-in fade-in-50 duration-300">
            <React.Suspense fallback={<PageSkeleton kpis={4} rows={6} cols={6} />}>
              <TesourariaPage embedded />
            </React.Suspense>
          </TabsContent>

          {/* Fluxo de Caixa */}
          <TabsContent value="fluxo" className="mt-4 animate-in fade-in-50 duration-300">
            <React.Suspense fallback={<PageSkeleton kpis={4} rows={6} cols={6} />}>
              <FluxoCaixaProjetadoPage embedded />
            </React.Suspense>
          </TabsContent>

          {/* Resultado */}
          <TabsContent value="resultado" className="mt-4 animate-in fade-in-50 duration-300">
            <Tabs value={subTab || 'dre'} onValueChange={setSubTab} className="w-full">
              <TabsList className="w-full max-w-lg mb-4 bg-gray-100/80">
                <TabsTrigger value="dre" className="flex-1">DRE por Obra</TabsTrigger>
                <TabsTrigger value="relatorios" className="flex-1">Relatórios</TabsTrigger>
                <TabsTrigger value="estrategico" className="flex-1">Estratégico</TabsTrigger>
              </TabsList>

              <React.Suspense fallback={<PageSkeleton kpis={4} rows={6} cols={6} />}>
                <TabsContent value="dre">
                  <DreObraPage embedded />
                </TabsContent>
                <TabsContent value="relatorios">
                  <RelatoriosAvancadosPage embedded />
                </TabsContent>
                <TabsContent value="estrategico">
                  <FinanceiroEstrategicoPage embedded />
                </TabsContent>
              </React.Suspense>
            </Tabs>
          </TabsContent>

          {/* Conciliação */}
          <TabsContent value="conciliacao" className="mt-4 animate-in fade-in-50 duration-300">
            <React.Suspense fallback={<PageSkeleton kpis={4} rows={6} cols={6} />}>
              <ConciliacaoPage embedded />
            </React.Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function Financeiro() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="FINANCEIRO_VIEW">
      <FinanceiroContent />
    </RouteGuardFinalV2>
  );
}