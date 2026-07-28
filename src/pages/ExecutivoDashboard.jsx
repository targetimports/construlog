import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useFinancePeriod } from '../components/shared/FinancePeriodProvider';
import { 
  TrendingUp,
  Award,
  Target,
  AlertTriangle,
  Users,
  Building2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  TrendingDown,
  Bug
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '../components/ui/PageHeader';
import RankingObras from '../components/executivo/RankingObras';
import RankingGestores from '../components/executivo/RankingGestores';
import AlertasEstrategicos from '../components/executivo/AlertasEstrategicos';
import ComparativoPeríodos from '../components/executivo/ComparativoPeriodos';
import ProjecaoCaixa3060 from '../components/tesouraria/ProjecaoCaixa3060';
import CapitalGiroObras from '../components/tesouraria/CapitalGiroObras';
import { createPageUrl } from '@/utils';
import { podeVerDashboardExecutivo, MODULOS } from '../components/auth/permissoesAcao';
import { PageSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

export default function ExecutivoDashboard() {
  const navigate = useNavigate();
  const { periodStart, periodEnd, periodMode, setPeriodMode, month, setMonth } = useFinancePeriod();
  const [showDebug, setShowDebug] = useState(false);
  const [obraFiltro, setObraFiltro] = useState('todas');

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-created_date', 500)
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  // Buscar KPIs Financeiros (ÚNICA FONTE DE VERDADE - mesmo do Financeiro Avançado)
  const { data: kpis, isLoading: loadingKPIs, refetch } = useQuery({
    queryKey: ['finance-advanced-kpis', periodStart, periodEnd, obraFiltro],
    queryFn: () => base44.functions.invoke('getFinanceAdvancedKPIs', {
      periodStart,
      periodEnd,
      obraId: obraFiltro === 'todas' ? null : obraFiltro
    }).then(res => res.data),
    enabled: !!periodStart && !!periodEnd
  });

  // Verificar acesso baseado em perfil_sistema
  useEffect(() => {
    if (user && user.perfil_sistema && !podeVerDashboardExecutivo(user.perfil_sistema)) {
      toast.error('Você não tem acesso ao Dashboard Executivo');
      navigate('/Dashboard');
    }
  }, [user, navigate]);

  // Loading state
  if (loadingUser) {
    return <PageSkeleton kpis={4} rows={6} cols={5} />;
  }

  // Se não tem permissão, retornar null (useEffect já redirecionou)
  if (user && user.perfil_sistema && !podeVerDashboardExecutivo(user.perfil_sistema)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full -ml-24 -mb-24" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Visão Executiva</h1>
              <p className="text-amber-100">Painel Estratégico da Diretoria</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-amber-100 text-sm mb-1">Recebido (Período)</p>
              <p className="text-2xl font-bold text-white">
                {(kpis?.kpis?.recebidoNoPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-amber-100 text-sm mb-1">A Receber</p>
              <p className="text-2xl font-bold text-white">
                {(kpis?.kpis?.aReceberPendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-amber-100 text-sm mb-1">Custos Operacionais</p>
              <p className="text-2xl font-bold text-white">
                {(kpis?.kpis?.custosOperacionaisTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-amber-100 text-sm mb-1">Saldo Caixa</p>
              <p className={`text-2xl font-bold ${(kpis?.kpis?.saldoCaixaPeriodo || 0) >= 0 ? 'text-white' : 'text-red-300'}`}>
                {(kpis?.kpis?.saldoCaixaPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Select value={periodMode} onValueChange={setPeriodMode}>
                <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white backdrop-blur-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTH">Por Mês</SelectItem>
                  <SelectItem value="RANGE">Range</SelectItem>
                </SelectContent>
              </Select>
              {periodMode === 'MONTH' && (
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white backdrop-blur-sm"
                />
              )}
              <Select value={obraFiltro} onValueChange={setObraFiltro}>
                <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white backdrop-blur-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Obras</SelectItem>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                {periodStart} até {periodEnd}
              </Badge>
              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-all"
                  title="Ver origem dos dados"
                >
                  <Bug className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debug Modal */}
      {showDebug && user?.role === 'admin' && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Debug: KPIs Avançados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-96 overflow-y-auto">
            <div className="text-xs space-y-2">
              <div className="p-2 bg-white rounded border">
                <p className="font-semibold">Período:</p>
                <p className="text-gray-700">{kpis?.periodo?.start} até {kpis?.periodo?.end}</p>
              </div>
              <div className="p-2 bg-white rounded border">
                <p className="font-semibold">Obra Filtro:</p>
                <p className="text-gray-700">{kpis?.obraIdUsada ? obras.find(o => o.id === kpis.obraIdUsada)?.nome : 'Todas as Obras'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <p className="font-semibold text-green-900">A Receber (Pendente)</p>
                  <p className="text-green-700">{(kpis?.kpis?.aReceberPendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="p-2 bg-red-50 rounded border border-red-200">
                  <p className="font-semibold text-red-900">A Pagar (Pendente)</p>
                  <p className="text-red-700">{(kpis?.kpis?.aPagarPendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="font-semibold text-blue-900">Recebido (Período)</p>
                  <p className="text-blue-700">{(kpis?.kpis?.recebidoNoPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="p-2 bg-orange-50 rounded border border-orange-200">
                  <p className="font-semibold text-orange-900">Pago (Período)</p>
                  <p className="text-orange-700">{(kpis?.kpis?.pagoNoPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                  <p className="font-semibold text-yellow-900">Custos Operacionais</p>
                  <p className="text-yellow-700">{(kpis?.kpis?.custosOperacionaisTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className={`p-2 rounded border ${(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`font-semibold ${(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>Lucro/Prejuízo</p>
                  <p className={`${(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs Financeiros (da mesma fonte do Financeiro Avançado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Custos Operacionais por Categoria */}
        <div 
          className="cursor-pointer"
          onClick={() => {
            const params = new URLSearchParams({
              periodStart,
              periodEnd,
              ...(obraFiltro !== 'todas' && { obraId: obraFiltro })
            });
            window.location.href = createPageUrl(`FinanceiroOperacional?${params.toString()}`);
          }}
        >
          <Card className="hover:shadow-lg transition-all h-full">
            <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Custos Operacionais (Período)</CardTitle>
              <DollarSign className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-xs text-gray-500">Mesma fonte: Financeiro Avançado</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {(kpis?.kpis?.custosOperacionaisTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Material</span>
                <span className="font-medium">{(kpis?.kpis?.custosPorCategoria?.material || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Mão de Obra</span>
                <span className="font-medium">{(kpis?.kpis?.custosPorCategoria?.maoDeObra || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Fretes</span>
                <span className="font-medium">{(kpis?.kpis?.custosPorCategoria?.fretes || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Lucro/Prejuízo */}
        <Card 
          className={`cursor-pointer hover:shadow-lg transition-all ${
            (kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) < 0 ? 'border-red-200' : 'border-green-200'
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) < 0 ? 'Prejuízo' : 'Lucro/Resultado'}
              </CardTitle>
              {(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) < 0 ? (
                <TrendingDown className="w-4 h-4 text-red-500" />
              ) : (
                <TrendingUp className="w-4 h-4 text-green-500" />
              )}
            </div>
            <p className="text-xs text-gray-500">Receita - Custos (período)</p>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${
              (kpis?.kpis?.lucroOuPrejuizoPeriodo || 0) < 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {(kpis?.kpis?.lucroOuPrejuizoPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Recebido (Período)</span>
                <span className="font-medium">{(kpis?.kpis?.recebidoNoPeriodo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Custos Totais</span>
                <span className="font-medium">{(kpis?.kpis?.custosOperacionaisTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Margem Lucro</span>
                <span className={`font-medium ${(kpis?.kpis?.margemLucro || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {(kpis?.kpis?.margemLucro || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projeção de Caixa 30/60/90 */}
      <ProjecaoCaixa3060 />

      {/* Alertas Estratégicos */}
      <AlertasEstrategicos obras={obras} contas={contas} colaboradores={colaboradores} />

      {/* Rankings */}
      <Tabs defaultValue="obras" className="space-y-6">
        <TabsList className="p-1 flex-wrap">
          <TabsTrigger value="obras">
            <Building2 className="w-4 h-4 mr-2" />
            Ranking de Obras
          </TabsTrigger>
          <TabsTrigger value="capital">
            <DollarSign className="w-4 h-4 mr-2" />
            Capital de Giro
          </TabsTrigger>
          <TabsTrigger value="gestores">
            <Users className="w-4 h-4 mr-2" />
            Ranking de Gestores
          </TabsTrigger>
          <TabsTrigger value="comparativo">
            <TrendingUp className="w-4 h-4 mr-2" />
            Comparativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="obras">
          <RankingObras obras={obras} contas={contas} medicoes={medicoes} />
        </TabsContent>

        <TabsContent value="capital">
          <CapitalGiroObras />
        </TabsContent>

        <TabsContent value="gestores">
          <RankingGestores obras={obras} colaboradores={colaboradores} contas={contas} />
        </TabsContent>

        <TabsContent value="comparativo">
          <ComparativoPeríodos obras={obras} contas={contas} periodStart={periodStart} periodEnd={periodEnd} />
        </TabsContent>
      </Tabs>
    </div>
  );
}