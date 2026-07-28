import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, AlertCircle, Settings, TrendingUp, Receipt, DollarSign, Zap, Brain, Sparkles } from 'lucide-react';
import DashboardFinanceiroRealTime from '../components/financeiro/DashboardFinanceiroRealTime';
import AlertasInteligentes from '../components/financeiro/AlertasInteligentes';
import ControlePagamentos from '../components/financeiro/ControlePagamentos';
import SimuladorCenarios from '../components/financeiro/SimuladorCenarios';
import DescontosRetencoes from '../components/financeiro/DescontosRetencoes';
import RelatoriosExport from '../components/financeiro/RelatoriosExport';
import AnalisadorFinanceiroIA from '../components/financeiro/AnalisadorFinanceiroIA';
import PrevisaoFluxoCaixaIA from '../components/financeiro/PrevisaoFluxoCaixaIA';

export default function FinanceiroAvancado() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Ler querystring para período e obra
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pb-12">
      {/* Header Premium */}
      <div className="relative overflow-hidden border-b border-blue-100 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent">Financeiro Avançado</h1>
                <p className="text-slate-600 mt-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Dashboard inteligente com IA em tempo real
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-8 w-full h-auto gap-1 p-1 bg-white border border-blue-200 rounded-xl shadow-sm">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="previsao" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Previsão</span>
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Pagtos</span>
            </TabsTrigger>
            <TabsTrigger value="simulador" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Simulador</span>
            </TabsTrigger>
            <TabsTrigger value="descontos" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100 col-span-1">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Descontos</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100 col-span-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="ia" className="flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-600 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-100 col-span-1">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">IA</span>
            </TabsTrigger>
          </TabsList>

        <TabsContent value="dashboard" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
            <DashboardFinanceiroRealTime />
          </div>
        </TabsContent>

        <TabsContent value="previsao" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
            <PrevisaoFluxoCaixaIA />
          </div>
        </TabsContent>

        <TabsContent value="alertas" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
            <AlertasInteligentes />
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-green-100 p-6">
            <ControlePagamentos />
          </div>
        </TabsContent>

        <TabsContent value="simulador" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
            <SimuladorCenarios />
          </div>
        </TabsContent>

        <TabsContent value="descontos" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-6">
            <DescontosRetencoes />
          </div>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-cyan-100 p-6">
            <RelatoriosExport />
          </div>
        </TabsContent>

        <TabsContent value="ia" className="mt-8 animate-in fade-in-50 duration-300">
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl shadow-sm border border-pink-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-pink-600" />
              <h2 className="text-xl font-bold text-pink-900">Análise com IA</h2>
            </div>
            <AnalisadorFinanceiroIA />
          </div>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}